import {
  addWorkLog as firestoreAddWorkLog,
  getSlotBySlotId,
  updateSlot,
} from "@/lib/firestore";
import {
  getNextState,
  isValidTransition,
  requiresPlantAssignment,
} from "@/lib/transitions";
import type { Activity } from "@/lib/types";

export async function addWorkLog(params: {
  plantNumber: string;
  plantName: string;
  date: Date;
  spaceType: string;
  slotId: string;
  activity: Activity;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const slot = await getSlotBySlotId(params.slotId);
  if (!slot) {
    return { ok: false, error: "Slot not found" };
  }

  if (!isValidTransition(slot.state, params.activity)) {
    return { ok: false, error: "Invalid activity for current slot state" };
  }

  const nextState = getNextState(slot.state, params.activity);

  await firestoreAddWorkLog({
    ...params,
    date: params.date,
  });

  const slotUpdates: Parameters<typeof updateSlot>[1] = {
    state: nextState,
    lastActivity: params.activity,
    lastChange: params.date,
  };

  if (requiresPlantAssignment(slot.state, params.activity)) {
    slotUpdates.plantNumber = params.plantNumber;
    slotUpdates.plantName = params.plantName;
  } else if (nextState !== "Growing") {
    slotUpdates.plantNumber = null;
    slotUpdates.plantName = null;
  }

  if (params.notes != null) {
    slotUpdates.notes = params.notes;
  }

  await updateSlot(slot.id, slotUpdates);
  return { ok: true };
}
