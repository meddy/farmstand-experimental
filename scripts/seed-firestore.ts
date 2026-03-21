#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import admin from "firebase-admin";

const ACTIVITIES = [
  "Plant",
  "Transplant",
  "Fertilize",
  "Flip",
  "Prep for Spring",
  "Install",
] as const;

/** Strip UTF-8 BOM so csv-parse column names match (e.g. "number" not "\ufeffnumber"). */
function stripUtf8Bom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

/** Normalize Bed/RaisedBed → Trough in slotId, spaceType, subspace. Apply RaisedBed first. */
function normalizeTrough(s: string): string {
  return s.replace(/RaisedBed/gi, "Trough").replace(/\bBED\b/gi, "Trough");
}

function parseDate(val: string): Date | null {
  const s = val.trim();
  if (!s) return null;
  // "10/31/25 12:00 AM" or "7/1/26" or "10/31/25"
  const parts = s.split(/\s+/);
  const datePart = parts[0];
  const [month, day, year] = datePart.split("/").map(Number);
  if (!month || !day || !year) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const d = new Date(fullYear, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function parsePlantRow(row: Record<string, string>): admin.firestore.DocumentData {
  const number = String(row.number ?? "").trim();
  const name = String(row.name ?? "").trim();
  const type = String(row.type ?? "").trim();
  const scientificName = String(row.scientificName ?? "").trim();
  const doc: admin.firestore.DocumentData = {
    number,
    name,
  };
  if (type) doc.type = type;
  if (scientificName) doc.scientificName = scientificName;
  return doc;
}

function parseSlotRow(row: Record<string, string>): admin.firestore.DocumentData {
  const slotId = normalizeTrough(String(row.slotId ?? "").trim());
  const spaceType = normalizeTrough(String(row.spaceType ?? "Bucket").trim());
  const subspaceRaw = row.subspace?.trim();
  const stateRaw = row.state?.trim();
  const lastActivityRaw = row.lastActivity?.trim();
  const lastChangeRaw = row.lastChange?.trim();
  const plantNumberRaw = row.plantNumber?.trim();
  const plantNameRaw = row.plantName?.trim();
  const notesRaw = row.notes?.trim();
  const planChangeRaw = row.planChange?.trim();

  let state: string | null = stateRaw === "" ? null : stateRaw || null;
  if (spaceType === "Bin" && state == null) {
    state = "Seed";
  }
  let lastActivity: string | null = null;
  if (lastActivityRaw) {
    lastActivity =
      lastActivityRaw === "Planted"
        ? "Plant"
        : lastActivityRaw === "Harvest"
          ? "Flip"
          : lastActivityRaw;
    if (!ACTIVITIES.includes(lastActivity as (typeof ACTIVITIES)[number])) {
      lastActivity = null;
    }
  }

  const lastChangeDate = parseDate(lastChangeRaw);
  const lastChange = lastChangeDate
    ? admin.firestore.Timestamp.fromDate(lastChangeDate)
    : admin.firestore.Timestamp.now();

  const plantNumber =
    !plantNumberRaw || plantNumberRaw === "undefined" || plantNumberRaw === "???"
      ? null
      : plantNumberRaw;
  const plantName = !plantNameRaw ? null : plantNameRaw;

  const doc: admin.firestore.DocumentData = {
    slotId,
    spaceType,
    state,
    lastChange,
    plantNumber,
    plantName,
  };
  if (subspaceRaw) doc.subspace = normalizeTrough(subspaceRaw);
  if (lastActivity) doc.lastActivity = lastActivity;
  if (notesRaw) doc.notes = notesRaw;

  const planChangeDate = parseDate(planChangeRaw);
  if (planChangeDate) {
    doc.planChange = admin.firestore.Timestamp.fromDate(planChangeDate);
  }

  return doc;
}

async function loadFirebasercProject(): Promise<string | null> {
  try {
    const path = resolve(process.cwd(), ".firebaserc");
    const json = JSON.parse(readFileSync(path, "utf-8"));
    return json.projects?.default ?? null;
  } catch {
    return null;
  }
}

function parseArgs(): {
  plants: string;
  slots: string;
  project: string | null;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  let plants = "";
  let slots = "";
  let project: string | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--plants" && args[i + 1]) {
      plants = args[++i];
    } else if (args[i] === "--slots" && args[i + 1]) {
      slots = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      project = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { plants, slots, project, dryRun };
}

async function main(): Promise<void> {
  const { plants, slots, project: projectArg, dryRun } = parseArgs();

  if (!plants || !slots) {
    console.error(
      "Usage: tsx scripts/seed-firestore.ts --plants <path> --slots <path> [--project <id>] [--dry-run]"
    );
    process.exit(1);
  }

  const projectId =
    projectArg ?? process.env.GCLOUD_PROJECT ?? (await loadFirebasercProject());

  if (!projectId) {
    console.error(
      "Project ID required. Use --project, GCLOUD_PROJECT, or .firebaserc."
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log("Dry run: no writes will be made.");
  }

  if (!admin.apps?.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();

  const plantsBuf = stripUtf8Bom(readFileSync(resolve(process.cwd(), plants), "utf-8"));
  const plantsRows = parse(plantsBuf, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const slotsBuf = stripUtf8Bom(readFileSync(resolve(process.cwd(), slots), "utf-8"));
  const slotsRows = parse(slotsBuf, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const plantDocs = plantsRows.map(parsePlantRow);
  const slotDocs = slotsRows.map(parseSlotRow);

  if (dryRun) {
    console.log(`Would upload ${plantDocs.length} plants, ${slotDocs.length} slots.`);
    return;
  }

  const BATCH_SIZE = 500;
  const plantsCol = db.collection("plants");
  const slotsCol = db.collection("slots");

  let plantCount = 0;
  for (let i = 0; i < plantDocs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = plantDocs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      const ref = plantsCol.doc();
      batch.set(ref, doc);
    }
    await batch.commit();
    plantCount += chunk.length;
    console.log(`Uploaded ${plantCount}/${plantDocs.length} plants`);
  }

  let slotCount = 0;
  for (let i = 0; i < slotDocs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = slotDocs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      const ref = slotsCol.doc();
      batch.set(ref, doc);
    }
    await batch.commit();
    slotCount += chunk.length;
    console.log(`Uploaded ${slotCount}/${slotDocs.length} slots`);
  }

  console.log(`Done. Uploaded ${plantCount} plants, ${slotCount} slots.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
