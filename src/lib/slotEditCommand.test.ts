import { describe, expect, it, vi } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { Slot } from "@/lib/types";
import {
  createSlotEditCommand,
  type SlotEditCommandDeps,
  type SlotEditDraft,
} from "@/lib/slotEditCommand";

function ts(): Timestamp {
  return { toDate: () => new Date(0) } as Timestamp;
}

function makeSlot(overrides: Partial<Slot> & Pick<Slot, "id" | "slotId">): Slot {
  return {
    ...overrides,
    spaceType: "Bucket",
    state: null,
    lastActivity: null,
    lastChange: ts(),
    plantNumber: null,
    plantName: null,
  };
}

function makeDeps(overrides: Partial<SlotEditCommandDeps> = {}): SlotEditCommandDeps {
  return {
    updateSlot: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const baseDraft = (overrides: Partial<SlotEditDraft> = {}): SlotEditDraft => ({
  state: "Growing",
  plantMode: "leave",
  ...overrides,
});

describe("createSlotEditCommand", () => {
  it("updates state and clears lastActivity", async () => {
    const deps = makeDeps();
    const cmd = createSlotEditCommand(deps);
    const slot = makeSlot({ id: "s1", slotId: "S1", state: "Fallow" });

    const result = await cmd.commit([slot], baseDraft({ state: "Prepped for Spring" }));

    expect(result.appliedCount).toBe(1);
    expect(result.failureCount).toBe(0);
    expect(deps.updateSlot).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        state: "Prepped for Spring",
        lastActivity: null,
      })
    );
    const patch = (deps.updateSlot as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as Record<string, unknown>;
    expect(patch.lastChange).toBeInstanceOf(Date);
  });

  it("supports bulk state-only edit with plant unchanged", async () => {
    const deps = makeDeps();
    const cmd = createSlotEditCommand(deps);
    const slots = [
      makeSlot({ id: "s1", slotId: "S1", plantNumber: "100", plantName: "Rose" }),
      makeSlot({ id: "s2", slotId: "S2", plantNumber: "200", plantName: "Mint" }),
    ];

    const result = await cmd.commit(
      slots,
      baseDraft({ state: "Seed", plantMode: "leave" })
    );

    expect(result.appliedCount).toBe(2);
    expect(deps.updateSlot).toHaveBeenNthCalledWith(
      1,
      "s1",
      expect.not.objectContaining({
        plantNumber: expect.anything(),
      })
    );
    expect(deps.updateSlot).toHaveBeenNthCalledWith(
      2,
      "s2",
      expect.not.objectContaining({
        plantName: expect.anything(),
      })
    );
  });

  it("sets plant values across selected slots", async () => {
    const deps = makeDeps();
    const cmd = createSlotEditCommand(deps);
    const slots = [
      makeSlot({ id: "s1", slotId: "S1" }),
      makeSlot({ id: "s2", slotId: "S2" }),
    ];

    const result = await cmd.commit(
      slots,
      baseDraft({
        state: "Growing",
        plantMode: "set",
        plantNumber: "9310",
        plantName: "Chives",
      })
    );

    expect(result.appliedCount).toBe(2);
    expect(deps.updateSlot).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        plantNumber: "9310",
        plantName: "Chives",
      })
    );
    expect(deps.updateSlot).toHaveBeenCalledWith(
      "s2",
      expect.objectContaining({
        plantNumber: "9310",
        plantName: "Chives",
      })
    );
  });

  it("clears plant values when requested", async () => {
    const deps = makeDeps();
    const cmd = createSlotEditCommand(deps);
    const slot = makeSlot({
      id: "s1",
      slotId: "S1",
      state: "Growing",
      plantNumber: "1234",
      plantName: "Basil",
    });

    const result = await cmd.commit(
      [slot],
      baseDraft({ state: null, plantMode: "clear" })
    );

    expect(result.appliedCount).toBe(1);
    expect(deps.updateSlot).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        state: null,
        plantNumber: null,
        plantName: null,
      })
    );
  });

  it("requires plant number and name together when setting plant", async () => {
    const deps = makeDeps();
    const cmd = createSlotEditCommand(deps);
    const slot = makeSlot({ id: "s1", slotId: "S1" });

    const result = await cmd.commit(
      [slot],
      baseDraft({
        state: "Growing",
        plantMode: "set",
        plantNumber: "9999",
        plantName: "",
      })
    );

    expect(result.appliedCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(result.results[0].error).toMatch(/Plant Number and Plant Name/i);
    expect(deps.updateSlot).not.toHaveBeenCalled();
  });
});
