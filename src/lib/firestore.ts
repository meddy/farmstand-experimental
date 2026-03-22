import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
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

export type PlantCreatePayload = {
  number: string;
  name: string;
  type?: string;
  scientificName?: string;
};

export async function addPlant(doc: PlantCreatePayload): Promise<string> {
  const col = collection(db, PLANTS_COL);
  const data: Record<string, unknown> = {
    number: doc.number.trim(),
    name: doc.name.trim(),
  };
  if (doc.type?.trim()) data.type = doc.type.trim();
  if (doc.scientificName?.trim()) data.scientificName = doc.scientificName.trim();
  const ref = await addDoc(col, data);
  return ref.id;
}

export async function deletePlant(plantDocId: string): Promise<void> {
  const ref = doc(db, PLANTS_COL, plantDocId);
  await deleteDoc(ref);
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

export async function getSlotsBySlotId(slotId: string): Promise<Slot[]> {
  const col = collection(db, SLOTS_COL);
  const q = query(col, where("slotId", "==", slotId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => slotFromDoc(d.id, d.data()));
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

export type SlotCreatePayload = {
  slotId: string;
  spaceType: string;
  subspace?: string;
  state: string | null;
  lastActivity?: string | null;
  plantNumber?: string | null;
  plantName?: string | null;
  notes?: string;
  planChange?: Date;
};

export async function addSlot(doc: SlotCreatePayload): Promise<string> {
  const col = collection(db, SLOTS_COL);
  const data: Record<string, unknown> = {
    slotId: doc.slotId.trim(),
    spaceType: doc.spaceType,
    state: doc.state,
    lastChange: serverTimestamp(),
    plantNumber: doc.plantNumber?.trim() || null,
    plantName: doc.plantName?.trim() || null,
  };
  if (doc.subspace?.trim()) data.subspace = doc.subspace.trim();
  if (doc.lastActivity) data.lastActivity = doc.lastActivity;
  if (doc.notes?.trim()) data.notes = doc.notes.trim();
  if (doc.planChange) {
    data.planChange = Timestamp.fromDate(doc.planChange);
  }
  const ref = await addDoc(col, data);
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

export async function getSlotById(slotDocId: string): Promise<Slot | null> {
  const ref = doc(db, SLOTS_COL, slotDocId);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) return null;
  return slotFromDoc(docSnap.id, docSnap.data());
}

export async function deleteSlot(slotDocId: string): Promise<void> {
  const ref = doc(db, SLOTS_COL, slotDocId);
  await deleteDoc(ref);
}

export async function deleteWorkLog(workLogDocId: string): Promise<void> {
  const ref = doc(db, WORK_LOGS_COL, workLogDocId);
  await deleteDoc(ref);
}

export async function getWorkLogsBySlotId(
  slotId: string,
  spaceType: string
): Promise<WorkLog[]> {
  const col = collection(db, WORK_LOGS_COL);
  const q = query(
    col,
    where("slotId", "==", slotId),
    where("spaceType", "==", spaceType)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => workLogFromDoc(d.id, d.data()));
}

export async function getSlotIdsForSubspace(
  spaceType: string,
  subspace: string
): Promise<string[]> {
  const col = collection(db, SLOTS_COL);
  const q = query(
    col,
    where("spaceType", "==", spaceType),
    where("subspace", "==", subspace)
  );
  const snap = await getDocs(q);
  const slotIds = [...new Set(snap.docs.map((d) => (d.data().slotId as string) ?? ""))];
  return slotIds.filter(Boolean);
}

export async function getWorkLogsByPlantNumber(
  plantNumber: string
): Promise<WorkLog[]> {
  const col = collection(db, WORK_LOGS_COL);
  const q = query(col, where("plantNumber", "==", plantNumber));
  const snap = await getDocs(q);
  return snap.docs.map((d) => workLogFromDoc(d.id, d.data()));
}

export function subscribeWorkLogsByPlantNumber(
  plantNumber: string,
  cb: (logs: WorkLog[]) => void
): Unsubscribe {
  const col = collection(db, WORK_LOGS_COL);
  const q = query(
    col,
    where("plantNumber", "==", plantNumber),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => workLogFromDoc(d.id, d.data()));
    cb(logs);
  });
}

const IN_QUERY_LIMIT = 10;

export function subscribeWorkLogsBySlotIds(
  slotIds: string[],
  cb: (logs: WorkLog[]) => void
): Unsubscribe {
  if (slotIds.length === 0) {
    cb([]);
    return () => {};
  }

  const unsubs: Unsubscribe[] = [];
  const allLogs = new Map<string, WorkLog>();

  const emit = () => {
    const sorted = [...allLogs.values()].sort((a, b) => {
      const aDate = a.date?.toDate?.() ?? new Date(0);
      const bDate = b.date?.toDate?.() ?? new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
    cb(sorted);
  };

  for (let i = 0; i < slotIds.length; i += IN_QUERY_LIMIT) {
    const chunk = slotIds.slice(i, i + IN_QUERY_LIMIT);
    const chunkSlotIdSet = new Set(chunk);
    const col = collection(db, WORK_LOGS_COL);
    const q = query(col, where("slotId", "in", chunk));
    const unsub = onSnapshot(q, (snap) => {
      const toDelete: string[] = [];
      for (const [id, log] of allLogs) {
        if (chunkSlotIdSet.has(log.slotId)) toDelete.push(id);
      }
      for (const id of toDelete) allLogs.delete(id);
      for (const d of snap.docs) {
        allLogs.set(d.id, workLogFromDoc(d.id, d.data()));
      }
      emit();
    });
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}
