import type { Plant, Slot, WorkLog } from "@/lib/types";
import {
  deletePlant as firestoreDeletePlant,
  deleteSlot as firestoreDeleteSlot,
  deleteWorkLog as firestoreDeleteWorkLog,
  getWorkLogsByPlantNumber as firestoreGetWorkLogsByPlantNumber,
  getWorkLogsBySlotId as firestoreGetWorkLogsBySlotId,
} from "@/lib/firestore";

export type EntityCascadeDeleteDeps = {
  getWorkLogsByPlantNumber: (plantNumber: string) => Promise<WorkLog[]>;
  getWorkLogsBySlotId: (slotId: string, spaceType: string) => Promise<WorkLog[]>;
  deleteWorkLog: (workLogDocId: string) => Promise<void>;
  deletePlant: (plantDocId: string) => Promise<void>;
  deleteSlot: (slotDocId: string) => Promise<void>;
};

export type EntityCascadeDeleteApi = {
  cascadeDeletePlant(plant: Plant): Promise<void>;
  cascadeDeleteSlot(slot: Slot): Promise<void>;
  deleteWorkLogEntry(workLogId: string): Promise<void>;
};

export function createEntityCascadeDelete(
  deps: EntityCascadeDeleteDeps
): EntityCascadeDeleteApi {
  return {
    async cascadeDeletePlant(plant: Plant): Promise<void> {
      const logs = await deps.getWorkLogsByPlantNumber(plant.number);
      await Promise.all(logs.map((log) => deps.deleteWorkLog(log.id)));
      await deps.deletePlant(plant.id);
    },

    async cascadeDeleteSlot(slot: Slot): Promise<void> {
      const logs = await deps.getWorkLogsBySlotId(slot.slotId, slot.spaceType);
      await Promise.all(logs.map((log) => deps.deleteWorkLog(log.id)));
      await deps.deleteSlot(slot.id);
    },

    async deleteWorkLogEntry(workLogId: string): Promise<void> {
      await deps.deleteWorkLog(workLogId);
    },
  };
}

const production = createEntityCascadeDelete({
  getWorkLogsByPlantNumber: firestoreGetWorkLogsByPlantNumber,
  getWorkLogsBySlotId: firestoreGetWorkLogsBySlotId,
  deleteWorkLog: firestoreDeleteWorkLog,
  deletePlant: firestoreDeletePlant,
  deleteSlot: firestoreDeleteSlot,
});

/** Deletes all work logs for the plant (by plantNumber), then the plant document. */
export async function cascadeDeletePlant(plant: Plant): Promise<void> {
  await production.cascadeDeletePlant(plant);
}

/** Deletes all work logs for the slot (by slotId + spaceType), then the slot document. */
export async function cascadeDeleteSlot(slot: Slot): Promise<void> {
  await production.cascadeDeleteSlot(slot);
}

/** Deletes a single work log document. */
export async function deleteWorkLogEntry(workLogId: string): Promise<void> {
  await production.deleteWorkLogEntry(workLogId);
}
