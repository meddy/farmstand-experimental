import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { Slot } from "@/lib/types";
import {
  getSubspaceOptionsForSpaceType,
  suggestNextSlotId,
} from "@/lib/slotIdSuggestion";

function ts(): Timestamp {
  return { toDate: () => new Date(0) } as Timestamp;
}

function makeSlot(overrides: Partial<Slot> & Pick<Slot, "slotId" | "spaceType">): Slot {
  return {
    id: overrides.id ?? overrides.slotId,
    lastActivity: null,
    lastChange: ts(),
    plantNumber: null,
    plantName: null,
    state: null,
    ...overrides,
  } as Slot;
}

describe("getSubspaceOptionsForSpaceType", () => {
  it("returns sorted unique subspaces for Bin", () => {
    const slots = [
      makeSlot({ slotId: "A-01", spaceType: "Bin", subspace: "Bin B" }),
      makeSlot({ slotId: "A-02", spaceType: "Bin", subspace: "Bin A" }),
      makeSlot({ slotId: "B-01", spaceType: "Bin", subspace: "Bin A" }),
    ];
    expect(getSubspaceOptionsForSpaceType(slots, "Bin")).toEqual(["Bin A", "Bin B"]);
  });

  it("returns empty for Bucket", () => {
    expect(getSubspaceOptionsForSpaceType([], "Bucket")).toEqual([]);
  });
});

describe("suggestNextSlotId", () => {
  it("returns null when no matching slots", () => {
    expect(suggestNextSlotId([], "Bucket", undefined)).toBeNull();
    expect(suggestNextSlotId([], "Bin", "Bin A")).toBeNull();
  });

  it("returns null for Bin/Trough without subspace", () => {
    const slots = [makeSlot({ slotId: "A-01", spaceType: "Bin", subspace: "Bin A" })];
    expect(suggestNextSlotId(slots, "Bin", "")).toBeNull();
    expect(suggestNextSlotId(slots, "Bin", undefined)).toBeNull();
  });

  it("suggests next Bucket id and fills gaps", () => {
    const slots = [
      makeSlot({ slotId: "B01", spaceType: "Bucket" }),
      makeSlot({ slotId: "B03", spaceType: "Bucket" }),
    ];
    expect(suggestNextSlotId(slots, "Bucket", undefined)).toBe("B02");
  });

  it("suggests after max when no gap in Bucket", () => {
    const slots = [
      makeSlot({ slotId: "B01", spaceType: "Bucket" }),
      makeSlot({ slotId: "B02", spaceType: "Bucket" }),
    ];
    expect(suggestNextSlotId(slots, "Bucket", undefined)).toBe("B03");
  });

  it("returns null when Bucket prefixes differ", () => {
    const slots = [
      makeSlot({ slotId: "B01", spaceType: "Bucket" }),
      makeSlot({ slotId: "C01", spaceType: "Bucket" }),
    ];
    expect(suggestNextSlotId(slots, "Bucket", undefined)).toBeNull();
  });

  it("suggests next Bin id for subspace and fills gaps", () => {
    const slots = [
      makeSlot({ slotId: "A-01", spaceType: "Bin", subspace: "Bin A" }),
      makeSlot({ slotId: "A-03", spaceType: "Bin", subspace: "Bin A" }),
    ];
    expect(suggestNextSlotId(slots, "Bin", "Bin A")).toBe("A-02");
  });

  it("ignores slots from other subspaces for Bin", () => {
    const slots = [
      makeSlot({ slotId: "A-01", spaceType: "Bin", subspace: "Bin A" }),
      makeSlot({ slotId: "B-99", spaceType: "Bin", subspace: "Bin B" }),
    ];
    expect(suggestNextSlotId(slots, "Bin", "Bin A")).toBe("A-02");
  });

  it("suggests missing Tray suffix before advancing number", () => {
    const slots = [
      makeSlot({ slotId: "T01-L", spaceType: "Tray" }),
      makeSlot({ slotId: "T01-R", spaceType: "Tray" }),
      makeSlot({ slotId: "T02-L", spaceType: "Tray" }),
    ];
    expect(suggestNextSlotId(slots, "Tray", undefined)).toBe("T02-R");
  });

  it("suggests next Tray number with first suffix when pairs complete", () => {
    const slots = [
      makeSlot({ slotId: "T44-L", spaceType: "Tray" }),
      makeSlot({ slotId: "T44-R", spaceType: "Tray" }),
    ];
    expect(suggestNextSlotId(slots, "Tray", undefined)).toBe("T45-L");
  });

  it("suggests Trough id matching subspace prefix", () => {
    const slots = [
      makeSlot({
        slotId: "BED 1-01",
        spaceType: "Trough",
        subspace: "BED 1",
      }),
      makeSlot({
        slotId: "BED 1-02",
        spaceType: "Trough",
        subspace: "BED 1",
      }),
    ];
    expect(suggestNextSlotId(slots, "Trough", "BED 1")).toBe("BED 1-03");
  });

  it("fills gaps in Trough sequence", () => {
    const slots = [
      makeSlot({ slotId: "BED 1-01", spaceType: "Trough", subspace: "BED 1" }),
      makeSlot({ slotId: "BED 1-03", spaceType: "Trough", subspace: "BED 1" }),
    ];
    expect(suggestNextSlotId(slots, "Trough", "BED 1")).toBe("BED 1-02");
  });

  it("returns null when patterns are inconsistent", () => {
    const slots = [
      makeSlot({ slotId: "B01", spaceType: "Bucket" }),
      makeSlot({ slotId: "B02-X", spaceType: "Bucket" }),
    ];
    expect(suggestNextSlotId(slots, "Bucket", undefined)).toBeNull();
  });
});
