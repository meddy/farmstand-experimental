import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Plant, Slot, WorkLog } from "./types";

const PLANTS_COL = "plants";
const SLOTS_COL = "slots";
const WORK_LOGS_COL = "workLogs";

function plantFromDoc(id: string, data: DocumentData): Plant {
  return {
    id,
    number: data.number ?? "",
    name: data.name ?? "",
    type: data.type,
    scientificName: data.scientificName,
  };
}

function slotFromDoc(id: string, data: DocumentData): Slot {
  return {
    id,
    slotId: data.slotId ?? "",
    spaceType: data.spaceType ?? "Bucket",
    subspace: data.subspace,
    state: data.state ?? null,
    lastActivity: data.lastActivity ?? null,
    lastChange: data.lastChange,
    plantNumber: data.plantNumber ?? null,
    plantName: data.plantName ?? null,
    notes: data.notes,
    planChange: data.planChange,
  };
}

function workLogFromDoc(id: string, data: DocumentData): WorkLog {
  return {
    id,
    plantNumber: data.plantNumber ?? "",
    plantName: data.plantName ?? "",
    date: data.date,
    spaceType: data.spaceType ?? "Bucket",
    slotId: data.slotId ?? "",
    activity: data.activity ?? "Plant",
    notes: data.notes,
    createdAt: data.createdAt,
  };
}

export function subscribePlants(cb: (plants: Plant[]) => void): Unsubscribe {
  const col = collection(db, PLANTS_COL);
  return onSnapshot(col, (snap) => {
    const plants = snap.docs.map((d) => plantFromDoc(d.id, d.data()));
    cb(plants);
  });
}

export function subscribeSlots(cb: (slots: Slot[]) => void): Unsubscribe {
  const col = collection(db, SLOTS_COL);
  return onSnapshot(col, (snap) => {
    const slots = snap.docs.map((d) => slotFromDoc(d.id, d.data()));
    cb(slots);
  });
}

export function subscribeSlotsBySpace(
  spaceType: string,
  subspace: string | null,
  cb: (slots: Slot[]) => void
): Unsubscribe {
  const col = collection(db, SLOTS_COL);
  let q = query(col, where("spaceType", "==", spaceType));
  if (subspace != null) {
    q = query(q, where("subspace", "==", subspace));
  }
  return onSnapshot(q, (snap) => {
    const slots = snap.docs.map((d) => slotFromDoc(d.id, d.data()));
    cb(slots);
  });
}

export function subscribeWorkLogs(cb: (logs: WorkLog[]) => void): Unsubscribe {
  const col = collection(db, WORK_LOGS_COL);
  const q = query(col, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => workLogFromDoc(d.id, d.data()));
    cb(logs);
  });
}

export async function getSlotBySlotId(slotId: string): Promise<Slot | null> {
  const col = collection(db, SLOTS_COL);
  const q = query(col, where("slotId", "==", slotId));
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  return slotFromDoc(first.id, first.data());
}

export async function addWorkLog(entry: {
  plantNumber: string;
  plantName: string;
  date: Date;
  spaceType: string;
  slotId: string;
  activity: string;
  notes?: string;
}): Promise<string> {
  const col = collection(db, WORK_LOGS_COL);
  const ref = await addDoc(col, {
    ...entry,
    date: entry.date,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSlot(
  slotDocId: string,
  updates: Partial<{
    state: string | null;
    lastActivity: string | null;
    lastChange: Date;
    plantNumber: string | null;
    plantName: string | null;
    notes: string;
  }>
): Promise<void> {
  const ref = doc(db, SLOTS_COL, slotDocId);
  await updateDoc(ref, updates);
}
