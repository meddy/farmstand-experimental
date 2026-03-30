import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { Plant, Slot, SpaceType } from "@/lib/types";
import {
  queryLookupSlots,
  SLOT_LOOKUP_ALL_SUBSPACES,
  type SlotLookupFilters,
} from "@/lib/slotQueryEngine";

function ts(ms: number): Timestamp {
  return { toDate: () => new Date(ms) } as Timestamp;
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

const defaultFilters = (
  overrides: Partial<SlotLookupFilters> = {}
): SlotLookupFilters => ({
  spaceType: null,
  subspace: SLOT_LOOKUP_ALL_SUBSPACES,
  plantQuery: "",
  sortField: "slotId",
  sortDirection: "asc",
  ...overrides,
});

describe("queryLookupSlots", () => {
  it("returns empty filteredSlots when no space and empty plant query", () => {
    const slots: Slot[] = [
      slot({ id: "1", slotId: "A", spaceType: "Bucket" as SpaceType }),
    ];
    const r = queryLookupSlots(slots, [], defaultFilters());
    expect(r.filteredSlots).toEqual([]);
    expect(r.showResults).toBe(false);
  });

  it("showResults is true when plant query is non-empty", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "A",
        spaceType: "Bucket",
        plantNumber: "92",
        plantName: "Rose",
      }),
    ];
    const plants: Plant[] = [{ id: "p1", number: "92", name: "Rose" }];
    const r = queryLookupSlots(slots, plants, defaultFilters({ plantQuery: "92" }));
    expect(r.showResults).toBe(true);
    expect(r.filteredSlots.length).toBeGreaterThan(0);
  });

  it("matches slots by plantNumber prefix (tier 1)", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "S1",
        spaceType: "Bucket",
        plantNumber: "9200",
        plantName: "X",
      }),
    ];
    const r = queryLookupSlots(slots, [], defaultFilters({ plantQuery: "92" }));
    expect(r.filteredSlots.map((s) => s.id)).toEqual(["1"]);
  });

  it("matches via plant number prefix then slot plantNumber (tier 2)", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "S1",
        spaceType: "Bucket",
        plantNumber: "100",
        plantName: "P",
      }),
    ];
    const plants: Plant[] = [{ id: "p1", number: "100", name: "P" }];
    const r = queryLookupSlots(slots, plants, defaultFilters({ plantQuery: "10" }));
    expect(r.filteredSlots.map((s) => s.id)).toEqual(["1"]);
  });

  it("matches via plant name contains (tier 3)", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "S1",
        spaceType: "Bucket",
        plantNumber: "5",
        plantName: "Rosemary",
      }),
    ];
    const plants: Plant[] = [{ id: "p1", number: "5", name: "Rosemary" }];
    const r = queryLookupSlots(slots, plants, defaultFilters({ plantQuery: "rose" }));
    expect(r.filteredSlots.map((s) => s.id)).toEqual(["1"]);
  });

  it("matches slot plantName substring when no plant doc (tier 4)", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "S1",
        spaceType: "Bucket",
        plantNumber: null,
        plantName: "Orphan Herb",
      }),
    ];
    const r = queryLookupSlots(slots, [], defaultFilters({ plantQuery: "herb" }));
    expect(r.filteredSlots.map((s) => s.id)).toEqual(["1"]);
  });

  it("deduplicates slot across tiers", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "S1",
        spaceType: "Bucket",
        plantNumber: "92",
        plantName: "R",
      }),
    ];
    const plants: Plant[] = [{ id: "p1", number: "92", name: "R" }];
    const r = queryLookupSlots(slots, plants, defaultFilters({ plantQuery: "92" }));
    expect(r.filteredSlots).toHaveLength(1);
  });

  it("space filter only returns slots in that space", () => {
    const slots: Slot[] = [
      slot({ id: "1", slotId: "A", spaceType: "Bucket" }),
      slot({ id: "2", slotId: "B", spaceType: "Tray" }),
    ];
    const r = queryLookupSlots(slots, [], defaultFilters({ spaceType: "Bucket" }));
    expect(r.filteredSlots.map((s) => s.id)).toEqual(["1"]);
  });

  it("space + plant: plant matching runs on subspace-filtered subset", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "A",
        spaceType: "Trough",
        subspace: "T1",
        plantNumber: "1",
        plantName: "P",
      }),
      slot({
        id: "2",
        slotId: "B",
        spaceType: "Trough",
        subspace: "T2",
        plantNumber: "1",
        plantName: "P",
      }),
    ];
    const plants: Plant[] = [{ id: "p1", number: "1", name: "P" }];
    const r = queryLookupSlots(slots, plants, {
      spaceType: "Trough",
      subspace: "T1",
      plantQuery: "1",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(r.filteredSlots.map((s) => s.id)).toEqual(["1"]);
  });

  it("subspace filter only applies for Trough and Bin", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "A",
        spaceType: "Bin",
        subspace: "B1",
      }),
      slot({
        id: "2",
        slotId: "C",
        spaceType: "Bin",
        subspace: "B2",
      }),
    ];
    const r = queryLookupSlots(slots, [], {
      spaceType: "Bin",
      subspace: "B1",
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(r.filteredSlots.map((s) => s.id)).toEqual(["1"]);
  });

  it("Bucket space ignores subspace value when filtering", () => {
    const slots: Slot[] = [
      slot({ id: "1", slotId: "A", spaceType: "Bucket", subspace: "x" }),
      slot({ id: "2", slotId: "B", spaceType: "Bucket" }),
    ];
    const r = queryLookupSlots(slots, [], {
      spaceType: "Bucket",
      subspace: "x",
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(r.filteredSlots.map((s) => s.id).sort()).toEqual(["1", "2"]);
  });

  it("sorts by slotId asc and desc", () => {
    const slots: Slot[] = [
      slot({ id: "1", slotId: "B", spaceType: "Bucket" }),
      slot({ id: "2", slotId: "A", spaceType: "Bucket" }),
    ];
    const asc = queryLookupSlots(slots, [], {
      spaceType: "Bucket",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(asc.filteredSlots.map((s) => s.slotId)).toEqual(["A", "B"]);
    const desc = queryLookupSlots(slots, [], {
      spaceType: "Bucket",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "desc",
    });
    expect(desc.filteredSlots.map((s) => s.slotId)).toEqual(["B", "A"]);
  });

  it("sorts by lastChange asc and desc", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "A",
        spaceType: "Bucket",
        lastChange: ts(100),
      }),
      slot({
        id: "2",
        slotId: "B",
        spaceType: "Bucket",
        lastChange: ts(200),
      }),
    ];
    const asc = queryLookupSlots(slots, [], {
      spaceType: "Bucket",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "lastChange",
      sortDirection: "asc",
    });
    expect(asc.filteredSlots.map((s) => s.id)).toEqual(["1", "2"]);
    const desc = queryLookupSlots(slots, [], {
      spaceType: "Bucket",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "lastChange",
      sortDirection: "desc",
    });
    expect(desc.filteredSlots.map((s) => s.id)).toEqual(["2", "1"]);
  });

  it("showSubspace is true only for Trough and Bin", () => {
    const slots: Slot[] = [];
    const trough = queryLookupSlots(slots, [], {
      spaceType: "Trough",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(trough.showSubspace).toBe(true);
    const bucket = queryLookupSlots(slots, [], {
      spaceType: "Bucket",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(bucket.showSubspace).toBe(false);
  });

  it("subspaceOptions lists unique subspaces for selected space", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "A",
        spaceType: "Trough",
        subspace: "north",
      }),
      slot({
        id: "2",
        slotId: "B",
        spaceType: "Trough",
        subspace: "south",
      }),
      slot({
        id: "3",
        slotId: "C",
        spaceType: "Trough",
        subspace: "north",
      }),
    ];
    const r = queryLookupSlots(slots, [], {
      spaceType: "Trough",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(r.subspaceOptions).toEqual(["north", "south"]);
  });

  it("whitespace-only plant query behaves as empty", () => {
    const slots: Slot[] = [
      slot({
        id: "1",
        slotId: "A",
        spaceType: "Bucket",
        plantNumber: "1",
      }),
    ];
    const r = queryLookupSlots(slots, [], defaultFilters({ plantQuery: "   " }));
    expect(r.filteredSlots).toEqual([]);
    expect(r.showResults).toBe(false);
  });

  it("empty slot and plant lists with space filter returns empty", () => {
    const r = queryLookupSlots([], [], {
      spaceType: "Bucket",
      subspace: SLOT_LOOKUP_ALL_SUBSPACES,
      plantQuery: "",
      sortField: "slotId",
      sortDirection: "asc",
    });
    expect(r.filteredSlots).toEqual([]);
  });
});
