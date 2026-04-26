#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const SLOTS_COLLECTION = "slots";
const BATCH_WRITE_LIMIT = 450;

type Args = {
  project: string | null;
  dryRun: boolean;
  apply: boolean;
};

type SlotDoc = {
  id: string;
  data: admin.firestore.DocumentData;
  normalizedSlotId: string;
  lastChangeMs: number;
};

type GroupPlan = {
  slotId: string;
  canonical: SlotDoc;
  duplicates: SlotDoc[];
  needsCanonicalWrite: boolean;
  deleteIds: string[];
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let project: string | null = null;
  let dryRun = true;
  let apply = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--project" && args[index + 1]) {
      project = args[++index];
    } else if (arg === "--apply") {
      apply = true;
      dryRun = false;
    } else if (arg === "--dry-run") {
      dryRun = true;
      apply = false;
    }
  }

  return { project, dryRun, apply };
}

async function loadFirebasercProject(): Promise<string | null> {
  try {
    const path = resolve(process.cwd(), ".firebaserc");
    const json = JSON.parse(readFileSync(path, "utf-8")) as {
      projects?: { default?: string };
    };
    return json.projects?.default ?? null;
  } catch {
    return null;
  }
}

function normalizeSlotId(raw: unknown, docId: string): string {
  const normalized = String(raw ?? "").trim();
  if (!normalized) {
    throw new Error(`Slot doc '${docId}' has an empty slotId after trimming.`);
  }
  if (normalized.includes("/")) {
    throw new Error(
      `Slot doc '${docId}' has invalid slotId '${normalized}' containing '/'.`
    );
  }
  return normalized;
}

function lastChangeToMs(value: unknown): number {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as admin.firestore.Timestamp).toMillis();
  }
  return 0;
}

function buildPlan(slotDocs: SlotDoc[]): GroupPlan[] {
  const groups = new Map<string, SlotDoc[]>();
  for (const slot of slotDocs) {
    const next = groups.get(slot.normalizedSlotId) ?? [];
    next.push(slot);
    groups.set(slot.normalizedSlotId, next);
  }

  const plans: GroupPlan[] = [];
  for (const [slotId, docs] of groups) {
    const sorted = [...docs].sort((a, b) => {
      if (b.lastChangeMs !== a.lastChangeMs) return b.lastChangeMs - a.lastChangeMs;
      return a.id.localeCompare(b.id);
    });
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);
    const needsCanonicalWrite =
      canonical.id !== slotId || String(canonical.data.slotId ?? "") !== slotId;
    const deleteIds = duplicates.map((d) => d.id);
    if (needsCanonicalWrite) {
      deleteIds.push(canonical.id);
    }
    plans.push({ slotId, canonical, duplicates, needsCanonicalWrite, deleteIds });
  }

  return plans.sort((a, b) => a.slotId.localeCompare(b.slotId));
}

function validateNoCrossGroupTargetConflicts(plans: GroupPlan[]): void {
  const ownerByDocId = new Map<string, string>();
  for (const plan of plans) {
    ownerByDocId.set(plan.canonical.id, plan.slotId);
    for (const duplicate of plan.duplicates) {
      ownerByDocId.set(duplicate.id, plan.slotId);
    }
  }

  for (const plan of plans) {
    const existingOwner = ownerByDocId.get(plan.slotId);
    if (existingOwner && existingOwner !== plan.slotId) {
      throw new Error(
        `Cannot move slot '${plan.slotId}' to doc '${plan.slotId}' because that doc ID belongs to slot '${existingOwner}'.`
      );
    }
  }
}

function printSummary(plans: GroupPlan[]): void {
  const duplicateGroups = plans.filter((p) => p.duplicates.length > 0);
  const canonicalWrites = plans.filter((p) => p.needsCanonicalWrite).length;
  const deletes = plans.reduce((sum, p) => sum + p.deleteIds.length, 0);

  console.log("Slot ID uniqueness migration plan:");
  console.log(
    JSON.stringify(
      {
        totalUniqueSlotIds: plans.length,
        duplicateGroups: duplicateGroups.length,
        duplicateDocsDeleted: duplicateGroups.reduce(
          (sum, p) => sum + p.duplicates.length,
          0
        ),
        canonicalWrites,
        totalDeletes: deletes,
      },
      null,
      2
    )
  );

  if (duplicateGroups.length === 0) return;
  console.log("Duplicate groups:");
  for (const group of duplicateGroups) {
    const canonical = group.canonical;
    console.log(
      `- slotId=${group.slotId} canonical=${canonical.id} lastChangeMs=${canonical.lastChangeMs}`
    );
    for (const duplicate of group.duplicates) {
      console.log(`  delete=${duplicate.id} lastChangeMs=${duplicate.lastChangeMs}`);
    }
  }
}

async function fetchSlots(db: admin.firestore.Firestore): Promise<SlotDoc[]> {
  const snap = await db.collection(SLOTS_COLLECTION).get();
  return snap.docs.map((document) => {
    const data = document.data();
    const normalizedSlotId = normalizeSlotId(data.slotId, document.id);
    return {
      id: document.id,
      data,
      normalizedSlotId,
      lastChangeMs: lastChangeToMs(data.lastChange),
    };
  });
}

async function applyPlan(
  db: admin.firestore.Firestore,
  plans: GroupPlan[]
): Promise<void> {
  const writes: Array<(batch: admin.firestore.WriteBatch) => void> = [];

  for (const plan of plans) {
    if (plan.needsCanonicalWrite) {
      writes.push((batch) => {
        const canonicalRef = db.collection(SLOTS_COLLECTION).doc(plan.slotId);
        const canonicalData = { ...plan.canonical.data, slotId: plan.slotId };
        batch.set(canonicalRef, canonicalData);
      });
    }

    for (const deleteId of plan.deleteIds) {
      writes.push((batch) => {
        const ref = db.collection(SLOTS_COLLECTION).doc(deleteId);
        batch.delete(ref);
      });
    }
  }

  let committed = 0;
  for (let index = 0; index < writes.length; index += BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    const chunk = writes.slice(index, index + BATCH_WRITE_LIMIT);
    for (const write of chunk) write(batch);
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${writes.length} writes`);
  }
}

async function main(): Promise<void> {
  const { project: projectArg, dryRun, apply } = parseArgs();
  const projectId =
    projectArg ?? process.env.GCLOUD_PROJECT ?? (await loadFirebasercProject());

  if (!projectId) {
    console.error(
      "Project ID required. Use --project, GCLOUD_PROJECT, or .firebaserc."
    );
    process.exit(1);
  }

  if (!admin.apps?.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const slots = await fetchSlots(db);
  const plans = buildPlan(slots);
  validateNoCrossGroupTargetConflicts(plans);
  printSummary(plans);

  if (dryRun && !apply) {
    console.log("Dry run mode: no writes applied. Re-run with --apply to commit.");
    return;
  }

  await applyPlan(db, plans);
  console.log("Slot ID uniqueness migration apply complete.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
