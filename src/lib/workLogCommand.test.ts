import { describe, expect, it, vi } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { Slot } from "@/lib/types";
import {
  createWorkLogCommand,
  type WorkLogCommandDeps,
  type WorkLogDraft,
} from "@/lib/workLogCommand";

function ts(): Timestamp {
  return { toDate: () => new Date(0) } as Timestamp;
}

function makeSlot(overrides: Partial<Slot> & Pick<Slot, "id" | "slotId">): Slot {
  return {
    spaceType: "Bucket",
    state: null,
    lastActivity: null,
    lastChange: ts(),
    plantNumber: null,
    plantName: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<WorkLogCommandDeps> = {}): WorkLogCommandDeps {
  return {
    addWorkLog: vi.fn().mockResolvedValue("log-id"),
    getSlotsBySlotId: vi.fn().mockResolvedValue([]),
    updateSlot: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const baseDraft = (overrides: Partial<WorkLogDraft> = {}): WorkLogDraft => ({
  activity: "Plant",
  plantNumber: "100",
  plantName: "Test Plant",
  date: new Date("2025-06-01"),
  notes: undefined,
  ...overrides,
});

describe("createWorkLogCommand", () => {
  describe("activitiesForSelection", () => {
    it("returns union of valid activities across slots", () => {
      const cmd = createWorkLogCommand(makeDeps());
      const nullState = makeSlot({ id: "1", slotId: "A", state: null });
      const growing = makeSlot({ id: "2", slotId: "B", state: "Growing" });
      const acts = cmd.activitiesForSelection([nullState, growing]);
      expect(acts).toContain("Plant");
      expect(acts).toContain("Transplant");
    });
  });

  describe("defaultActivity", () => {
    it("returns first intersection activity when non-empty", () => {
      const cmd = createWorkLogCommand(makeDeps());
      const s1 = makeSlot({ id: "1", slotId: "A", state: null });
      const s2 = makeSlot({ id: "2", slotId: "B", state: null });
      const d = cmd.defaultActivity([s1, s2]);
      expect(d).toBeDefined();
      expect(cmd.activitiesForSelection([s1, s2])).toContain(d!);
      const inter = cmd
        .activitiesForSelection([s1])
        .filter((a) => cmd.activitiesForSelection([s2]).includes(a));
      expect(inter[0]).toBe(d);
    });

    it("with one slot returns an activity from activitiesForSelection", () => {
      const cmd = createWorkLogCommand(makeDeps());
      const s = makeSlot({ id: "1", slotId: "A", state: null });
      const d = cmd.defaultActivity([s]);
      const union = cmd.activitiesForSelection([s]);
      expect(d).toBeDefined();
      expect(union).toContain(d!);
    });
  });

  describe("previewConflicts", () => {
    it("detects invalid transition", () => {
      const cmd = createWorkLogCommand(makeDeps());
      const nullState = makeSlot({ id: "1", slotId: "A", state: null });
      const c = cmd.previewConflicts([nullState], baseDraft({ activity: "Flip" }));
      expect(c.length).toBe(1);
      expect(c[0].slot.id).toBe("1");
      expect(c[0].reason).toMatch(/not valid/i);
    });

    it("detects missing plant for Growing transition", () => {
      const cmd = createWorkLogCommand(makeDeps());
      const nullState = makeSlot({ id: "1", slotId: "A", state: null });
      const c = cmd.previewConflicts(
        [nullState],
        baseDraft({ plantNumber: "", plantName: "" })
      );
      expect(c.some((x) => x.reason.includes("Plant is required"))).toBe(true);
    });
  });

  describe("commit", () => {
    it("writes work log and updates slot for valid slot", async () => {
      const slotDoc = makeSlot({
        id: "doc-1",
        slotId: "S1",
        state: null,
        spaceType: "Tray",
      });
      const deps = makeDeps({
        getSlotsBySlotId: vi.fn().mockResolvedValue([slotDoc]),
      });
      const cmd = createWorkLogCommand(deps);
      const result = await cmd.commit([slotDoc], baseDraft());

      expect(result.skipped).toHaveLength(0);
      expect(result.attemptedSlotIds).toEqual(["S1"]);
      expect(result.appliedCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(deps.addWorkLog).toHaveBeenCalledWith(
        expect.objectContaining({
          slotId: "S1",
          spaceType: "Tray",
          activity: "Plant",
        })
      );
      expect(deps.updateSlot).toHaveBeenCalledWith(
        "doc-1",
        expect.objectContaining({ state: "Growing" })
      );
    });

    it("skips conflicting slots and still applies valid ones", async () => {
      const valid = makeSlot({
        id: "d1",
        slotId: "OK",
        state: "Growing",
        plantNumber: "1",
        plantName: "P",
      });
      const bad = makeSlot({ id: "d2", slotId: "BAD", state: null });
      const deps = makeDeps({
        getSlotsBySlotId: vi.fn().mockImplementation((id: string) => {
          if (id === "OK") return Promise.resolve([valid]);
          return Promise.resolve([bad]);
        }),
      });
      const cmd = createWorkLogCommand(deps);
      const result = await cmd.commit([valid, bad], baseDraft({ activity: "Flip" }));

      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].slot.slotId).toBe("BAD");
      expect(result.appliedCount).toBe(1);
      expect(deps.addWorkLog).toHaveBeenCalledTimes(1);
    });

    it("deduplicates by slotId before writing", async () => {
      const a = makeSlot({ id: "d1", slotId: "S1", state: null });
      const b = makeSlot({ id: "d2", slotId: "S1", state: null });
      const deps = makeDeps({
        getSlotsBySlotId: vi.fn().mockResolvedValue([a]),
      });
      const cmd = createWorkLogCommand(deps);
      const result = await cmd.commit([a, b], baseDraft());

      expect(result.attemptedSlotIds).toEqual(["S1"]);
      expect(deps.getSlotsBySlotId).toHaveBeenCalledTimes(1);
      expect(deps.addWorkLog).toHaveBeenCalledTimes(1);
    });

    it("clears plant when transitioning away from Growing", async () => {
      const slotDoc = makeSlot({
        id: "d1",
        slotId: "S1",
        state: "Growing",
        plantNumber: "5",
        plantName: "Rose",
      });
      const deps = makeDeps({
        getSlotsBySlotId: vi.fn().mockResolvedValue([slotDoc]),
      });
      const cmd = createWorkLogCommand(deps);
      await cmd.commit([slotDoc], baseDraft({ activity: "Transplant" }));

      expect(deps.updateSlot).toHaveBeenCalledWith(
        "d1",
        expect.objectContaining({
          plantNumber: null,
          plantName: null,
          state: "Fallow",
        })
      );
    });

    it("reports failure when re-read finds no slot", async () => {
      const slotDoc = makeSlot({ id: "d1", slotId: "S1", state: null });
      const deps = makeDeps({
        getSlotsBySlotId: vi.fn().mockResolvedValue([]),
      });
      const cmd = createWorkLogCommand(deps);
      const result = await cmd.commit([slotDoc], baseDraft());

      expect(result.appliedCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.results[0].ok).toBe(false);
      expect(deps.addWorkLog).not.toHaveBeenCalled();
    });
  });
});
