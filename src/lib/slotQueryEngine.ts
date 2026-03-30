import { plantNumberMatchesPrefix } from "@/lib/utils";
import type { Plant, Slot, SpaceType } from "@/lib/types";

/** Sentinel: no subspace filter (all subspaces). */
export const SLOT_LOOKUP_ALL_SUBSPACES = "__all__";

const HAS_SUBSPACE: SpaceType[] = ["Trough", "Bin"];

export type SlotLookupSortField = "slotId" | "lastChange";
export type SlotLookupSortDirection = "asc" | "desc";

export type SlotLookupFilters = {
  spaceType: SpaceType | null;
  /** Use `SLOT_LOOKUP_ALL_SUBSPACES` when not filtering by subspace. */
  subspace: string;
  plantQuery: string;
  sortField: SlotLookupSortField;
  sortDirection: SlotLookupSortDirection;
};

export type SlotLookupResult = {
  filteredSlots: Slot[];
  subspaceOptions: string[];
  showSubspace: boolean;
  showResults: boolean;
};

function slotsMatchingPlant(
  slots: Slot[],
  plants: Pick<Plant, "number" | "name">[],
  query: string
): Slot[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const results: Slot[] = [];
  const nameLower = trimmed.toLowerCase();

  for (const slot of slots) {
    if (
      slot.plantNumber &&
      plantNumberMatchesPrefix(trimmed, slot.plantNumber) &&
      !seen.has(slot.id)
    ) {
      seen.add(slot.id);
      results.push(slot);
    }
  }

  const matchingPlantsByNumber = plants.filter((p) =>
    plantNumberMatchesPrefix(trimmed, p.number)
  );
  for (const plant of matchingPlantsByNumber) {
    for (const slot of slots) {
      if (slot.plantNumber === plant.number && !seen.has(slot.id)) {
        seen.add(slot.id);
        results.push(slot);
      }
    }
  }

  const byName = plants.filter((p) => p.name?.toLowerCase().includes(nameLower));
  for (const plant of byName) {
    for (const slot of slots) {
      if (slot.plantNumber === plant.number && !seen.has(slot.id)) {
        seen.add(slot.id);
        results.push(slot);
      }
    }
  }

  for (const slot of slots) {
    if (slot.plantName?.toLowerCase().includes(nameLower) && !seen.has(slot.id)) {
      seen.add(slot.id);
      results.push(slot);
    }
  }

  return results;
}

function getLastChangeTime(s: Slot): number {
  return s.lastChange?.toDate?.()?.getTime() ?? 0;
}

/**
 * Pure slot lookup: space/subspace/plant filters, sorting, and derived UI flags.
 */
export function queryLookupSlots(
  slots: Slot[],
  plants: Plant[],
  filters: SlotLookupFilters
): SlotLookupResult {
  const { spaceType, subspace, plantQuery, sortField, sortDirection } = filters;

  const showSubspace = spaceType !== null && HAS_SUBSPACE.includes(spaceType);
  const showResults = spaceType !== null || plantQuery.trim().length > 0;

  let subspaceOptions: string[] = [];
  if (spaceType && HAS_SUBSPACE.includes(spaceType)) {
    const set = new Set<string>();
    slots
      .filter((s) => s.spaceType === spaceType && s.subspace)
      .forEach((s) => set.add(s.subspace!));
    subspaceOptions = Array.from(set).toSorted();
  }

  const hasSpaceFilter = spaceType !== null;
  const hasPlantFilter = plantQuery.trim().length > 0;

  let list: Slot[];

  if (!hasSpaceFilter && !hasPlantFilter) {
    list = [];
  } else if (hasSpaceFilter && hasPlantFilter) {
    const spaceFiltered = slots.filter((s) => s.spaceType === spaceType!);
    const subspaceFiltered =
      HAS_SUBSPACE.includes(spaceType!) && subspace !== SLOT_LOOKUP_ALL_SUBSPACES
        ? spaceFiltered.filter((s) => s.subspace === subspace)
        : spaceFiltered;
    list = slotsMatchingPlant(subspaceFiltered, plants, plantQuery);
  } else if (hasSpaceFilter) {
    list = slots.filter((s) => s.spaceType === spaceType!);
    if (HAS_SUBSPACE.includes(spaceType!) && subspace !== SLOT_LOOKUP_ALL_SUBSPACES) {
      list = list.filter((s) => s.subspace === subspace);
    }
  } else {
    list = slotsMatchingPlant(slots, plants, plantQuery);
  }

  const filteredSlots = [...list].sort((a, b) => {
    if (sortField === "slotId") {
      const cmp = a.slotId.localeCompare(b.slotId);
      return sortDirection === "asc" ? cmp : -cmp;
    }
    const aTime = getLastChangeTime(a);
    const bTime = getLastChangeTime(b);
    const cmp = aTime - bTime;
    return sortDirection === "asc" ? cmp : -cmp;
  });

  return {
    filteredSlots,
    subspaceOptions,
    showSubspace,
    showResults,
  };
}
