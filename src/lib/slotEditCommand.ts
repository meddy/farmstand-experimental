import { updateSlot as firestoreUpdateSlot } from "@/lib/firestore";
import { SLOT_STATES, type Slot, type SlotState } from "@/lib/types";

export type SlotUpdatePatch = Parameters<typeof firestoreUpdateSlot>[1];

export type PlantEditMode = "leave" | "set" | "clear";

export interface SlotEditDraft {
  state: SlotState;
  plantMode: PlantEditMode;
  plantNumber?: string;
  plantName?: string;
}

export interface SlotEditResult {
  attemptedSlotDocIds: string[];
  results: Array<{ slotDocId: string; slotId: string; ok: boolean; error?: string }>;
  appliedCount: number;
  failureCount: number;
}

export interface SlotEditCommandDeps {
  updateSlot: (slotDocId: string, updates: SlotUpdatePatch) => Promise<void>;
}

export interface SlotEditCommandModule {
  validateDraft(draft: SlotEditDraft): string | null;
  commit(slots: Slot[], draft: SlotEditDraft): Promise<SlotEditResult>;
}

function normalizeState(state: SlotState): SlotState {
  if (state === null) return null;
  return SLOT_STATES.includes(state) ? state : null;
}

function normalizePlantValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function buildPatch(draft: SlotEditDraft): SlotUpdatePatch {
  const patch: SlotUpdatePatch = {
    state: normalizeState(draft.state),
    lastActivity: null,
    lastChange: new Date(),
  };

  if (draft.plantMode === "set") {
    patch.plantNumber = normalizePlantValue(draft.plantNumber);
    patch.plantName = normalizePlantValue(draft.plantName);
  } else if (draft.plantMode === "clear") {
    patch.plantNumber = null;
    patch.plantName = null;
  }

  return patch;
}

export function createSlotEditCommand(
  deps: SlotEditCommandDeps
): SlotEditCommandModule {
  return {
    validateDraft(draft: SlotEditDraft): string | null {
      if (draft.state !== null && !SLOT_STATES.includes(draft.state)) {
        return "State is invalid";
      }
      if (draft.plantMode === "set") {
        const plantNumber = normalizePlantValue(draft.plantNumber);
        const plantName = normalizePlantValue(draft.plantName);
        if (!plantNumber || !plantName) {
          return "Plant Number and Plant Name are required";
        }
      }
      return null;
    },

    async commit(slots: Slot[], draft: SlotEditDraft): Promise<SlotEditResult> {
      const attemptedSlotDocIds = slots.map((slot) => slot.id);
      const reason = this.validateDraft(draft);
      if (reason) {
        return {
          attemptedSlotDocIds,
          results: slots.map((slot) => ({
            slotDocId: slot.id,
            slotId: slot.slotId,
            ok: false,
            error: reason,
          })),
          appliedCount: 0,
          failureCount: slots.length,
        };
      }

      const patch = buildPatch(draft);
      const settled = await Promise.all(
        slots.map(async (slot) => {
          try {
            await deps.updateSlot(slot.id, patch);
            return { slotDocId: slot.id, slotId: slot.slotId, ok: true as const };
          } catch (error) {
            return {
              slotDocId: slot.id,
              slotId: slot.slotId,
              ok: false as const,
              error: error instanceof Error ? error.message : "Failed to update slot",
            };
          }
        })
      );

      const appliedCount = settled.filter((item) => item.ok).length;
      const failureCount = settled.length - appliedCount;

      return {
        attemptedSlotDocIds,
        results: settled,
        appliedCount,
        failureCount,
      };
    },
  };
}

const production = createSlotEditCommand({
  updateSlot: firestoreUpdateSlot,
});

export const slotEditCommand: SlotEditCommandModule = production;
