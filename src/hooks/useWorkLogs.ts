import {
  addWorkLog as firestoreAddWorkLog,
  getSlotsBySlotId,
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
  const slots = await getSlotsBySlotId(params.slotId);
  if (slots.length === 0) {
    return { ok: false, error: "Slot not found" };
  }

  const slot = slots[0];
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

  for (const s of slots) {
    await updateSlot(s.id, slotUpdates);
  }
  return { ok: true };
}
