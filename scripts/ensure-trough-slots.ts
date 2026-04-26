#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const SLOTS_COLLECTION = "slots";
const WORK_LOGS_COLLECTION = "workLogs";
const TARGET_SPACE_TYPE = "Trough";
const SLOT_COUNT_PER_SUBSPACE = 25;
const BATCH_WRITE_LIMIT = 450;

type EnsureArgs = {
  project: string | null;
  dryRun: boolean;
  apply: boolean;
};

type SlotDoc = {
  id: string;
  slotId: string;
  spaceType: string;
  subspace?: string;
  state?: string | null;
  lastActivity?: string | null;
  lastChange?: admin.firestore.Timestamp | null;
  plantNumber?: string | null;
  plantName?: string | null;
  notes?: string;
  planChange?: admin.firestore.Timestamp;
};

type WorkLogDoc = {
  id: string;
  slotId: string;
  spaceType: string;
};

type PlannedMigration = {
  renameSlotUpdates: number;
  mergedCanonicalUpdates: number;
  duplicateDeletes: number;
  createdSlots: number;
  workLogUpdates: number;
  existingTroughSubspaces: number;
};

function parseArgs(): EnsureArgs {
  const args = process.argv.slice(2);
  let project: string | null = null;
  let dryRun = true;
  let apply = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--project" && args[index + 1]) {
      project = args[++index];
    } else if (arg === "--dry-run") {
      dryRun = true;
      apply = false;
    } else if (arg === "--apply") {
      apply = true;
      dryRun = false;
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

function normalizeTroughText(raw: string): string {
  return raw.replace(/RaisedBed/gi, "Trough").replace(/\bBED\b/gi, "Trough");
}

function canonicalizeSubspace(rawSubspace?: string): string | null {
  if (!rawSubspace) return null;
  const normalized = normalizeTroughText(rawSubspace).trim();
  const match = normalized.match(/^Trough\s*(\d{1,2})$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 99) return null;
  return `Trough ${String(numeric).padStart(2, "0")}`;
}

function canonicalizeSlotId(rawSlotId?: string): string | null {
  if (!rawSlotId) return null;
  const normalized = normalizeTroughText(rawSlotId).trim();
  const match = normalized.match(/^Trough\s*(\d{1,2})-(\d{1,2})$/i);
  if (!match) return null;
  const troughNumber = Number(match[1]);
  const position = Number(match[2]);
  if (!Number.isInteger(troughNumber) || troughNumber <= 0 || troughNumber > 99)
    return null;
  if (!Number.isInteger(position) || position <= 0 || position > 99) return null;
  return `Trough ${String(troughNumber).padStart(2, "0")}-${String(position).padStart(2, "0")}`;
}

function normalizeSpaceType(rawSpaceType?: string): string {
  return normalizeTroughText(rawSpaceType ?? "").trim();
}

function isMissing(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function mergedCanonicalPatch(
  canonical: SlotDoc,
  duplicate: SlotDoc
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const candidateFields: Array<keyof SlotDoc> = [
    "state",
    "lastActivity",
    "lastChange",
    "plantNumber",
    "plantName",
    "notes",
    "planChange",
  ];

  for (const field of candidateFields) {
    const canonicalValue = canonical[field];
    const duplicateValue = duplicate[field];
    if (isMissing(canonicalValue) && !isMissing(duplicateValue)) {
      patch[field] = duplicateValue as unknown;
    }
  }

  return patch;
}

async function fetchTroughSlots(
  db: admin.firestore.Firestore
): Promise<{ slots: SlotDoc[]; canonicalSubspaces: Set<string> }> {
  const slotsSnap = await db.collection(SLOTS_COLLECTION).get();
  const slots: SlotDoc[] = [];
  const canonicalSubspaces = new Set<string>();

  for (const doc of slotsSnap.docs) {
    const data = doc.data();
    const spaceType = normalizeSpaceType(data.spaceType as string | undefined);
    const canonicalSubspace = canonicalizeSubspace(data.subspace as string | undefined);

    if (spaceType !== TARGET_SPACE_TYPE) continue;
    if (!canonicalSubspace) continue;

    slots.push({
      id: doc.id,
      slotId: String(data.slotId ?? ""),
      spaceType,
      subspace: String(data.subspace ?? ""),
      state: (data.state as string | null | undefined) ?? null,
      lastActivity: (data.lastActivity as string | null | undefined) ?? null,
      lastChange: (data.lastChange as admin.firestore.Timestamp | undefined) ?? null,
      plantNumber: (data.plantNumber as string | null | undefined) ?? null,
      plantName: (data.plantName as string | null | undefined) ?? null,
      notes: data.notes as string | undefined,
      planChange: data.planChange as admin.firestore.Timestamp | undefined,
    });
    canonicalSubspaces.add(canonicalSubspace);
  }

  return { slots, canonicalSubspaces };
}

async function fetchWorkLogs(db: admin.firestore.Firestore): Promise<WorkLogDoc[]> {
  const logsSnap = await db.collection(WORK_LOGS_COLLECTION).get();
  return logsSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        slotId: String(data.slotId ?? ""),
        spaceType: normalizeSpaceType(data.spaceType as string | undefined),
      };
    })
    .filter((log) => log.spaceType === TARGET_SPACE_TYPE);
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

  const { slots, canonicalSubspaces } = await fetchTroughSlots(db);
  const workLogs = await fetchWorkLogs(db);

  const canonicalSlotToDoc = new Map<string, SlotDoc>();
  const canonicalToDuplicates = new Map<string, SlotDoc[]>();
  const legacyToCanonicalSlotId = new Map<string, string>();
  const slotUpdatePatches = new Map<string, Record<string, unknown>>();
  const duplicateDeleteIds = new Set<string>();
  const createdSlots: Array<{
    slotId: string;
    subspace: string;
    data: Record<string, unknown>;
  }> = [];

  for (const slot of slots) {
    const canonicalSubspace = canonicalizeSubspace(slot.subspace);
    const canonicalSlotId = canonicalizeSlotId(slot.slotId);
    if (!canonicalSubspace || !canonicalSlotId) continue;

    legacyToCanonicalSlotId.set(slot.slotId, canonicalSlotId);

    if (!canonicalSlotToDoc.has(canonicalSlotId)) {
      canonicalSlotToDoc.set(canonicalSlotId, slot);
      const patch: Record<string, unknown> = {};
      if (slot.slotId !== canonicalSlotId) patch.slotId = canonicalSlotId;
      if (slot.subspace !== canonicalSubspace) patch.subspace = canonicalSubspace;
      if (Object.keys(patch).length > 0) {
        slotUpdatePatches.set(slot.id, patch);
      }
      continue;
    }

    const canonicalDoc = canonicalSlotToDoc.get(canonicalSlotId)!;
    const canonicalDocSubspace = canonicalizeSubspace(canonicalDoc.subspace);
    if (canonicalDocSubspace !== canonicalSubspace) {
      throw new Error(
        `Subspace mismatch for ${canonicalSlotId}: ${canonicalDoc.id} vs ${slot.id}.`
      );
    }

    const duplicateList = canonicalToDuplicates.get(canonicalSlotId) ?? [];
    duplicateList.push(slot);
    canonicalToDuplicates.set(canonicalSlotId, duplicateList);
  }

  for (const [canonicalSlotId, duplicates] of canonicalToDuplicates) {
    const canonicalDoc = canonicalSlotToDoc.get(canonicalSlotId)!;
    const mergedPatch = slotUpdatePatches.get(canonicalDoc.id) ?? {};

    for (const duplicate of duplicates) {
      const fillPatch = mergedCanonicalPatch(canonicalDoc, duplicate);
      for (const [field, value] of Object.entries(fillPatch)) {
        if (mergedPatch[field] === undefined) mergedPatch[field] = value;
      }
      duplicateDeleteIds.add(duplicate.id);
      legacyToCanonicalSlotId.set(duplicate.slotId, canonicalSlotId);
    }

    if (Object.keys(mergedPatch).length > 0) {
      slotUpdatePatches.set(canonicalDoc.id, mergedPatch);
    }
  }

  for (const subspace of canonicalSubspaces) {
    for (let position = 1; position <= SLOT_COUNT_PER_SUBSPACE; position++) {
      const canonicalSlotId = `${subspace}-${String(position).padStart(2, "0")}`;
      if (canonicalSlotToDoc.has(canonicalSlotId)) continue;

      const data: Record<string, unknown> = {
        slotId: canonicalSlotId,
        spaceType: TARGET_SPACE_TYPE,
        subspace,
        state: null,
        lastActivity: null,
        lastChange: admin.firestore.Timestamp.now(),
        plantNumber: null,
        plantName: null,
      };

      createdSlots.push({ slotId: canonicalSlotId, subspace, data });
      canonicalSlotToDoc.set(canonicalSlotId, {
        id: "",
        slotId: canonicalSlotId,
        spaceType: TARGET_SPACE_TYPE,
        subspace,
      });
    }
  }

  const workLogPatches: Array<{ id: string; slotId: string }> = [];
  for (const log of workLogs) {
    const canonicalSlotId = legacyToCanonicalSlotId.get(log.slotId);
    if (!canonicalSlotId) continue;
    if (canonicalSlotId === log.slotId) continue;
    workLogPatches.push({ id: log.id, slotId: canonicalSlotId });
  }

  const summary: PlannedMigration = {
    renameSlotUpdates: Array.from(slotUpdatePatches.values()).filter(
      (patch) => patch.slotId !== undefined || patch.subspace !== undefined
    ).length,
    mergedCanonicalUpdates: Array.from(slotUpdatePatches.values()).filter(
      (patch) =>
        patch.slotId === undefined &&
        patch.subspace === undefined &&
        Object.keys(patch).length > 0
    ).length,
    duplicateDeletes: duplicateDeleteIds.size,
    createdSlots: createdSlots.length,
    workLogUpdates: workLogPatches.length,
    existingTroughSubspaces: canonicalSubspaces.size,
  };

  console.log("Trough migration plan:");
  console.log(JSON.stringify(summary, null, 2));

  if (dryRun && !apply) {
    console.log(
      "Dry run mode: no writes applied. Re-run with --apply to commit changes."
    );
    return;
  }

  const writes: Array<(batch: admin.firestore.WriteBatch) => void> = [];

  for (const [slotDocId, patch] of slotUpdatePatches) {
    writes.push((batch) => {
      const ref = db.collection(SLOTS_COLLECTION).doc(slotDocId);
      batch.update(ref, patch);
    });
  }

  for (const duplicateId of duplicateDeleteIds) {
    writes.push((batch) => {
      const ref = db.collection(SLOTS_COLLECTION).doc(duplicateId);
      batch.delete(ref);
    });
  }

  for (const newSlot of createdSlots) {
    writes.push((batch) => {
      const ref = db.collection(SLOTS_COLLECTION).doc();
      batch.set(ref, newSlot.data);
    });
  }

  for (const patch of workLogPatches) {
    writes.push((batch) => {
      const ref = db.collection(WORK_LOGS_COLLECTION).doc(patch.id);
      batch.update(ref, { slotId: patch.slotId });
    });
  }

  let committed = 0;
  for (let index = 0; index < writes.length; index += BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    const chunk = writes.slice(index, index + BATCH_WRITE_LIMIT);
    for (const writeOp of chunk) writeOp(batch);
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${writes.length} write operations`);
  }

  console.log("Trough migration apply complete.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
