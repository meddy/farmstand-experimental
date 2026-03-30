import {
  addWorkLog as firestoreAddWorkLog,
  getSlotsBySlotId as firestoreGetSlotsBySlotId,
  updateSlot as firestoreUpdateSlot,
} from "@/lib/firestore";
import { ACTIVITIES, type Activity, type Slot } from "@/lib/types";
import {
  getNextState,
  isValidTransition,
  requiresPlantAssignment,
} from "@/lib/transitions";
import { getSlotConflict } from "@/lib/workLogValidation";

export interface WorkLogDraft {
  activity: Activity;
  plantNumber: string;
  plantName: string;
  date: Date;
  notes?: string;
}

export interface SlotConflict {
  slot: Slot;
  reason: string;
}

export interface CommitResult {
  attemptedSlotIds: string[];
  skipped: SlotConflict[];
  results: Array<{ slotId: string; ok: boolean; error?: string }>;
  appliedCount: number;
  failureCount: number;
}

export type WorkLogWritePayload = {
  plantNumber: string;
  plantName: string;
  date: Date;
  spaceType: string;
  slotId: string;
  activity: Activity;
  notes?: string;
};

export type SlotUpdatePatch = Parameters<typeof firestoreUpdateSlot>[1];

export interface WorkLogCommandDeps {
  addWorkLog: (entry: WorkLogWritePayload) => Promise<string>;
  getSlotsBySlotId: (slotId: string) => Promise<Slot[]>;
  updateSlot: (slotDocId: string, updates: SlotUpdatePatch) => Promise<void>;
}

export interface WorkLogCommandModule {
  activitiesForSelection(slots: Slot[]): Activity[];
  defaultActivity(slots: Slot[]): Activity | undefined;
  previewConflicts(slots: Slot[], draft: WorkLogDraft): SlotConflict[];
  commit(slots: Slot[], draft: WorkLogDraft): Promise<CommitResult>;
}

function activitiesUnion(slots: Slot[]): Activity[] {
  const union = new Set<Activity>();
  for (const slot of slots) {
    for (const a of ACTIVITIES) {
      if (isValidTransition(slot.state ?? null, a as Activity)) {
        union.add(a as Activity);
      }
    }
  }
  return Array.from(union);
}

function activitiesIntersection(slots: Slot[]): Activity[] {
  if (slots.length === 0) return [];
  let intersection = activitiesUnion([slots[0]]);
  for (let i = 1; i < slots.length; i++) {
    const valid = new Set(activitiesUnion([slots[i]]));
    intersection = intersection.filter((a) => valid.has(a));
  }
  return intersection;
}

async function executeWorkLogForSlotId(
  deps: WorkLogCommandDeps,
  slotId: string,
  draft: WorkLogDraft
): Promise<{ ok: boolean; error?: string }> {
  const fresh = await deps.getSlotsBySlotId(slotId);
  if (fresh.length === 0) {
    return { ok: false, error: "Slot not found" };
  }

  const slot = fresh[0];
  const conflictReason = getSlotConflict(
    slot,
    draft.activity,
    draft.plantNumber,
    draft.plantName
  );
  if (conflictReason) {
    return { ok: false, error: conflictReason };
  }

  const nextState = getNextState(slot.state, draft.activity);

  await deps.addWorkLog({
    plantNumber: draft.plantNumber,
    plantName: draft.plantName,
    date: draft.date,
    spaceType: slot.spaceType,
    slotId,
    activity: draft.activity,
    notes: draft.notes,
  });

  const slotUpdates: SlotUpdatePatch = {
    state: nextState,
    lastActivity: draft.activity,
    lastChange: draft.date,
  };

  if (requiresPlantAssignment(slot.state, draft.activity)) {
    slotUpdates.plantNumber = draft.plantNumber;
    slotUpdates.plantName = draft.plantName;
  } else if (nextState !== "Growing") {
    slotUpdates.plantNumber = null;
    slotUpdates.plantName = null;
  }

  if (draft.notes != null) {
    slotUpdates.notes = draft.notes;
  }

  for (const s of fresh) {
    await deps.updateSlot(s.id, slotUpdates);
  }

  return { ok: true };
}

export function createWorkLogCommand(deps: WorkLogCommandDeps): WorkLogCommandModule {
  return {
    activitiesForSelection(slots: Slot[]) {
      return activitiesUnion(slots);
    },

    defaultActivity(slots: Slot[]) {
      const intersection = activitiesIntersection(slots);
      if (intersection.length > 0) return intersection[0];
      const union = activitiesUnion(slots);
      return union[0];
    },

    previewConflicts(slots: Slot[], draft: WorkLogDraft): SlotConflict[] {
      const out: SlotConflict[] = [];
      for (const slot of slots) {
        const reason = getSlotConflict(
          slot,
          draft.activity,
          draft.plantNumber,
          draft.plantName
        );
        if (reason) out.push({ slot, reason });
      }
      return out;
    },

    async commit(slots: Slot[], draft: WorkLogDraft): Promise<CommitResult> {
      const skipped: SlotConflict[] = [];
      const validSlots: Slot[] = [];

      for (const slot of slots) {
        const reason = getSlotConflict(
          slot,
          draft.activity,
          draft.plantNumber,
          draft.plantName
        );
        if (reason) {
          skipped.push({ slot, reason });
        } else {
          validSlots.push(slot);
        }
      }

      const uniqueBySlotId = Array.from(
        new Map(validSlots.map((s) => [s.slotId, s])).values()
      );
      const attemptedSlotIds = uniqueBySlotId.map((s) => s.slotId);

      const results = await Promise.all(
        attemptedSlotIds.map(async (slotId) => {
          const r = await executeWorkLogForSlotId(deps, slotId, draft);
          return { slotId, ok: r.ok, error: r.error };
        })
      );

      const appliedCount = results.filter((r) => r.ok).length;
      const failureCount = results.filter((r) => !r.ok).length;

      return {
        attemptedSlotIds,
        skipped,
        results,
        appliedCount,
        failureCount,
      };
    },
  };
}

const production = createWorkLogCommand({
  addWorkLog: firestoreAddWorkLog,
  getSlotsBySlotId: firestoreGetSlotsBySlotId,
  updateSlot: firestoreUpdateSlot,
});

export const workLogCommand: WorkLogCommandModule = production;
