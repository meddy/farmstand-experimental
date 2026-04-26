#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const WORK_LOGS_COLLECTION = "workLogs";
const BATCH_WRITE_LIMIT = 450;

type Args = {
  project: string | null;
  dryRun: boolean;
  apply: boolean;
};

type BackfillCandidate = {
  id: string;
  plantNumber: string | null;
  plantBaseNumber: string | null;
  nextPlantBaseNumber: string | null;
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

function getPlantBaseNumber(plantNumber: string | null): string | null {
  const trimmed = String(plantNumber ?? "").trim();
  if (!trimmed) return null;
  const [base] = trimmed.split(".", 1);
  const normalized = base?.trim() ?? "";
  return normalized || null;
}

async function collectCandidates(
  db: admin.firestore.Firestore
): Promise<BackfillCandidate[]> {
  const snap = await db.collection(WORK_LOGS_COLLECTION).get();
  const candidates: BackfillCandidate[] = [];

  for (const document of snap.docs) {
    const data = document.data();
    const plantNumber = (data.plantNumber as string | null | undefined) ?? null;
    const currentBase =
      (data.plantBaseNumber as string | null | undefined)?.trim() || null;
    const nextBase = getPlantBaseNumber(plantNumber);
    if (currentBase === nextBase) continue;
    candidates.push({
      id: document.id,
      plantNumber,
      plantBaseNumber: currentBase,
      nextPlantBaseNumber: nextBase,
    });
  }

  return candidates;
}

async function applyCandidates(
  db: admin.firestore.Firestore,
  candidates: BackfillCandidate[]
): Promise<void> {
  const writes: Array<(batch: admin.firestore.WriteBatch) => void> = [];

  for (const candidate of candidates) {
    writes.push((batch) => {
      const ref = db.collection(WORK_LOGS_COLLECTION).doc(candidate.id);
      batch.update(ref, { plantBaseNumber: candidate.nextPlantBaseNumber });
    });
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
  const candidates = await collectCandidates(db);

  console.log(
    JSON.stringify(
      {
        projectId,
        totalCandidates: candidates.length,
      },
      null,
      2
    )
  );

  if (dryRun || !apply) {
    console.log("Dry run complete. Re-run with --apply to write changes.");
    return;
  }

  await applyCandidates(db, candidates);
  console.log("Backfill complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
