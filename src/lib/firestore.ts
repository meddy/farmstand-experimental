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
  runTransaction,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Plant, Slot, WorkLog } from "./types";
import { getPlantBaseNumber } from "./utils";

const PLANTS_COL = "plants";
const SLOTS_COL = "slots";
const WORK_LOGS_COL = "workLogs";

function normalizeSlotId(slotId: string): string {
  const normalized = slotId.trim();
  if (!normalized) {
    throw new Error("Slot ID is required");
  }
  if (normalized.includes("/")) {
    throw new Error("Slot ID cannot contain '/'");
  }
  return normalized;
}

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
  const plantNumber = data.plantNumber ?? null;
  const fallbackBaseNumber = getPlantBaseNumber(plantNumber ?? "") || null;
  const plantBaseNumber = data.plantBaseNumber ?? fallbackBaseNumber;
  return {
    id,
    plantNumber,
    plantBaseNumber,
    plantName: data.plantName ?? null,
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
  const normalizedSlotId = normalizeSlotId(slotId);
  const ref = doc(db, SLOTS_COL, normalizedSlotId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return [slotFromDoc(snap.id, snap.data())];
}

export async function addWorkLog(entry: {
  plantNumber: string | null;
  plantBaseNumber?: string | null;
  plantName: string | null;
  date: Date;
  spaceType: string;
  slotId: string;
  activity: string;
  notes?: string;
}): Promise<string> {
  const col = collection(db, WORK_LOGS_COL);
  const fallbackBaseNumber = getPlantBaseNumber(entry.plantNumber ?? "") || null;
  const resolvedBaseNumber = entry.plantBaseNumber ?? fallbackBaseNumber;
  const ref = await addDoc(col, {
    ...entry,
    plantBaseNumber: resolvedBaseNumber,
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

export async function addSlot(slot: SlotCreatePayload): Promise<string> {
  const normalizedSlotId = normalizeSlotId(slot.slotId);
  const data: Record<string, unknown> = {
    slotId: normalizedSlotId,
    spaceType: slot.spaceType,
    state: slot.state,
    lastChange: serverTimestamp(),
    plantNumber: slot.plantNumber?.trim() || null,
    plantName: slot.plantName?.trim() || null,
  };
  if (slot.subspace?.trim()) data.subspace = slot.subspace.trim();
  if (slot.lastActivity) data.lastActivity = slot.lastActivity;
  if (slot.notes?.trim()) data.notes = slot.notes.trim();
  if (slot.planChange) {
    data.planChange = Timestamp.fromDate(slot.planChange);
  }
  await runTransaction(db, async (transaction) => {
    const slotDocRef = doc(db, SLOTS_COL, normalizedSlotId);
    const existing = await transaction.get(slotDocRef);
    if (existing.exists()) {
      throw new Error(`Slot ID '${normalizedSlotId}' already exists`);
    }
    transaction.set(slotDocRef, data);
  });
  return normalizedSlotId;
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

export function subscribeWorkLogsByPlantBaseNumber(
  plantBaseNumber: string,
  cb: (logs: WorkLog[]) => void
): Unsubscribe {
  const col = collection(db, WORK_LOGS_COL);
  const q = query(
    col,
    where("plantBaseNumber", "==", plantBaseNumber),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => workLogFromDoc(d.id, d.data()));
    cb(logs);
  });
}

export function subscribeWorkLogsByPlantBaseNumbers(
  plantBaseNumbers: string[],
  cb: (logs: WorkLog[]) => void
): Unsubscribe {
  const normalizedBaseNumbers = Array.from(
    new Set(plantBaseNumbers.map((value) => value.trim()).filter(Boolean))
  );
  if (normalizedBaseNumbers.length === 0) {
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

  for (let i = 0; i < normalizedBaseNumbers.length; i += IN_QUERY_LIMIT) {
    const chunk = normalizedBaseNumbers.slice(i, i + IN_QUERY_LIMIT);
    const chunkBaseNumberSet = new Set(chunk);
    const col = collection(db, WORK_LOGS_COL);
    const q = query(
      col,
      where("plantBaseNumber", "in", chunk),
      orderBy("date", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const toDelete: string[] = [];
      for (const [id, log] of allLogs) {
        if (chunkBaseNumberSet.has(log.plantBaseNumber ?? "")) toDelete.push(id);
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
