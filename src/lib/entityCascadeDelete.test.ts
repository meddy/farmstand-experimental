import { describe, expect, it, vi } from "vitest";
import type { Plant, Slot, WorkLog } from "@/lib/types";
import {
  createEntityCascadeDelete,
  type EntityCascadeDeleteDeps,
} from "@/lib/entityCascadeDelete";

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: "plant-1",
    number: "100",
    name: "Test",
    ...overrides,
  };
}

function slotEntity(overrides: Partial<Slot> = {}): Slot {
  return {
    id: "slot-doc-1",
    slotId: "A01",
    spaceType: "Bucket",
    state: null,
    lastActivity: null,
    lastChange: {} as Slot["lastChange"],
    plantNumber: null,
    plantName: null,
    ...overrides,
  };
}

function log(id: string): WorkLog {
  return {
    id,
    plantNumber: "100",
    plantName: "T",
    date: {} as WorkLog["date"],
    spaceType: "Bucket",
    slotId: "A01",
    activity: "Plant",
    createdAt: {} as WorkLog["createdAt"],
  };
}

function makeDeps(
  overrides: Partial<EntityCascadeDeleteDeps> = {}
): EntityCascadeDeleteDeps {
  return {
    getWorkLogsByPlantNumber: vi.fn().mockResolvedValue([]),
    getWorkLogsBySlotId: vi.fn().mockResolvedValue([]),
    deleteWorkLog: vi.fn().mockResolvedValue(undefined),
    deletePlant: vi.fn().mockResolvedValue(undefined),
    deleteSlot: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createEntityCascadeDelete", () => {
  it("cascadeDeletePlant fetches logs by plant number, deletes logs then plant", async () => {
    const deps = makeDeps({
      getWorkLogsByPlantNumber: vi.fn().mockResolvedValue([log("w1"), log("w2")]),
    });
    const api = createEntityCascadeDelete(deps);
    await api.cascadeDeletePlant(plant({ number: "42" }));

    expect(deps.getWorkLogsByPlantNumber).toHaveBeenCalledWith("42");
    expect(deps.deleteWorkLog).toHaveBeenCalledTimes(2);
    expect(deps.deleteWorkLog).toHaveBeenCalledWith("w1");
    expect(deps.deleteWorkLog).toHaveBeenCalledWith("w2");
    expect(deps.deletePlant).toHaveBeenCalledWith("plant-1");
    const plantOrder = (deps.deletePlant as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const lastLogOrder = Math.max(
      (deps.deleteWorkLog as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (deps.deleteWorkLog as ReturnType<typeof vi.fn>).mock.invocationCallOrder[1]
    );
    expect(plantOrder).toBeGreaterThan(lastLogOrder);
  });

  it("cascadeDeletePlant with no logs still deletes plant", async () => {
    const deps = makeDeps();
    const api = createEntityCascadeDelete(deps);
    await api.cascadeDeletePlant(plant());
    expect(deps.deleteWorkLog).not.toHaveBeenCalled();
    expect(deps.deletePlant).toHaveBeenCalledWith("plant-1");
  });

  it("cascadeDeleteSlot queries by slotId and spaceType, deletes logs then slot", async () => {
    const deps = makeDeps({
      getWorkLogsBySlotId: vi.fn().mockResolvedValue([log("a")]),
    });
    const api = createEntityCascadeDelete(deps);
    const s = slotEntity({ slotId: "S1", spaceType: "Tray" });
    await api.cascadeDeleteSlot(s);

    expect(deps.getWorkLogsBySlotId).toHaveBeenCalledWith("S1", "Tray");
    expect(deps.deleteWorkLog).toHaveBeenCalledWith("a");
    expect(deps.deleteSlot).toHaveBeenCalledWith("slot-doc-1");
    expect(
      (deps.deleteSlot as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    ).toBeGreaterThan(
      (deps.deleteWorkLog as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    );
  });

  it("propagates error when a work log delete fails and does not delete parent", async () => {
    const deps = makeDeps({
      getWorkLogsByPlantNumber: vi.fn().mockResolvedValue([log("w1")]),
      deleteWorkLog: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const api = createEntityCascadeDelete(deps);
    await expect(api.cascadeDeletePlant(plant())).rejects.toThrow("boom");
    expect(deps.deletePlant).not.toHaveBeenCalled();
  });

  it("deleteWorkLogEntry deletes by id", async () => {
    const deps = makeDeps();
    const api = createEntityCascadeDelete(deps);
    await api.deleteWorkLogEntry("x-99");
    expect(deps.deleteWorkLog).toHaveBeenCalledWith("x-99");
    expect(deps.deletePlant).not.toHaveBeenCalled();
    expect(deps.deleteSlot).not.toHaveBeenCalled();
  });
});
