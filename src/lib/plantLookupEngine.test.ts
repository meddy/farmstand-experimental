import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { Plant, Slot, WorkLog } from "@/lib/types";
import { getPlantLookupSeeds, queryLookupPlants } from "@/lib/plantLookupEngine";

function ts(ms: number): Timestamp {
  return { toDate: () => new Date(ms) } as Timestamp;
}

function plant(
  overrides: Partial<Plant> & Pick<Plant, "id" | "number" | "name">
): Plant {
  return { ...overrides };
}

function slot(
  overrides: Partial<Slot> & Pick<Slot, "id" | "slotId" | "spaceType">
): Slot {
  return {
    state: null,
    lastActivity: null,
    lastChange: ts(0),
    plantNumber: null,
    plantName: null,
    ...overrides,
  };
}

function workLog(
  overrides: Partial<WorkLog> &
    Pick<WorkLog, "id" | "activity" | "slotId" | "spaceType">
): WorkLog {
  return {
    plantNumber: null,
    plantName: null,
    date: ts(0),
    createdAt: ts(0),
    ...overrides,
  };
}

describe("getPlantLookupSeeds", () => {
  it("groups matching plant instances by base number", () => {
    const plants: Plant[] = [
      plant({ id: "p1", number: "9382.1", name: "Oregano" }),
      plant({ id: "p2", number: "9382.2", name: "Oregano" }),
    ];
    const seeds = getPlantLookupSeeds(plants, [], "9382");
    expect(seeds).toHaveLength(1);
    expect(seeds[0].baseNumber).toBe("9382");
    expect([...seeds[0].plantInstances]).toEqual(["9382.1", "9382.2"]);
  });
});

describe("queryLookupPlants", () => {
  it("shows no results for empty query", () => {
    const result = queryLookupPlants([], [], [], "   ");
    expect(result.showResults).toBe(false);
    expect(result.groups).toEqual([]);
  });

  it("supports base-number query that returns multiple instances", () => {
    const plants: Plant[] = [
      plant({ id: "p1", number: "9382.1", name: 'OREGANO "True Greek"' }),
      plant({ id: "p2", number: "9382.2", name: 'OREGANO "True Greek"' }),
    ];
    const slots: Slot[] = [
      slot({
        id: "s1",
        slotId: "Bin 01",
        spaceType: "Bin",
        subspace: "Bin M",
        state: "Seed",
        plantNumber: "9382.1",
        plantName: 'OREGANO "True Greek"',
      }),
      slot({
        id: "s2",
        slotId: "Bin 02",
        spaceType: "Bin",
        subspace: "Bin N",
        state: "Seed",
        plantNumber: "9382.2",
        plantName: 'OREGANO "True Greek"',
      }),
    ];
    const logs: WorkLog[] = [
      workLog({
        id: "w1",
        activity: "Plant",
        slotId: "Bin 01",
        spaceType: "Bin",
        plantNumber: "9382.1",
        plantBaseNumber: "9382",
        date: ts(100),
      }),
    ];

    const result = queryLookupPlants(plants, slots, logs, "9382");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].baseNumber).toBe("9382");
    expect(result.groups[0].stateGroups[0].locationGroups).toHaveLength(2);
    expect(result.groups[0].workLogSummary[0].slotLabel).toBe("Bin 01");
  });

  it("supports instance query that narrows to one instance", () => {
    const slots: Slot[] = [
      slot({
        id: "s1",
        slotId: "Bucket 01",
        spaceType: "Bucket",
        state: "Growing",
        plantNumber: "9382.1",
        plantName: "Oregano",
      }),
      slot({
        id: "s2",
        slotId: "Bucket 02",
        spaceType: "Bucket",
        state: "Growing",
        plantNumber: "9382.2",
        plantName: "Oregano",
      }),
    ];
    const logs: WorkLog[] = [
      workLog({
        id: "w1",
        activity: "Fertilize",
        slotId: "Bucket 01",
        spaceType: "Bucket",
        plantNumber: "9382.1",
        plantBaseNumber: "9382",
        date: ts(100),
      }),
      workLog({
        id: "w2",
        activity: "Fertilize",
        slotId: "Bucket 02",
        spaceType: "Bucket",
        plantNumber: "9382.2",
        plantBaseNumber: "9382",
        date: ts(200),
      }),
    ];

    const result = queryLookupPlants([], slots, logs, "9382.1");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].stateGroups[0].locationGroups[0].instances).toHaveLength(1);
    expect(result.groups[0].workLogSummary).toHaveLength(1);
    expect(result.groups[0].workLogSummary[0].plantInstance).toBe("9382.1");
  });

  it("marks heading conflict names when group has multiple plant names", () => {
    const plants: Plant[] = [
      plant({ id: "p1", number: "100.1", name: "Rosemary" }),
      plant({ id: "p2", number: "100.2", name: "Rosemary Alt" }),
    ];
    const result = queryLookupPlants(plants, [], [], "100");
    expect(result.groups[0].headingName).toBe("Rosemary");
    expect(result.groups[0].headingConflictNames).toEqual(["Rosemary Alt"]);
  });

  it("shows slot label only for Plant/Transplant summary rows", () => {
    const logs: WorkLog[] = [
      workLog({
        id: "w1",
        activity: "Plant",
        slotId: "Bin M",
        spaceType: "Bin",
        plantNumber: "9382.1",
        plantBaseNumber: "9382",
      }),
      workLog({
        id: "w2",
        activity: "Fertilize",
        slotId: "Bin M",
        spaceType: "Bin",
        plantNumber: "9382.1",
        plantBaseNumber: "9382",
      }),
    ];
    const result = queryLookupPlants([], [], logs, "9382");
    expect(result.groups[0].workLogSummary[0].slotLabel).toBe("Bin M");
    expect(result.groups[0].workLogSummary[1].slotLabel).toBeNull();
  });
});
