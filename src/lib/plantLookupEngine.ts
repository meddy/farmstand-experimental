import type { Plant, Slot, WorkLog } from "@/lib/types";
import { getPlantBaseNumber, plantNumberMatchesQuery } from "@/lib/utils";

const PLANTING_ACTIVITIES = new Set(["Plant", "Transplant"]);

type PlantStateGroup = {
  stateLabel: string;
  locationGroups: Array<{
    locationLabel: string;
    instances: Array<{ plantInstance: string; slotId: string }>;
  }>;
  hasMultipleLocations: boolean;
};

export type PlantWorkLogSummaryRow = {
  id: string;
  plantInstance: string | null;
  date: Date | null;
  activity: string;
  activityLabel: string;
  slotLabel: string | null;
};

export type PlantLookupGroup = {
  baseNumber: string;
  headingName: string;
  headingConflictNames: string[];
  stateGroups: PlantStateGroup[];
  workLogSummary: PlantWorkLogSummaryRow[];
};

export type PlantLookupResult = {
  showResults: boolean;
  groups: PlantLookupGroup[];
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function locationForSlot(slot: Slot): string {
  const subspace = norm(slot.subspace);
  if (subspace && subspace.toLowerCase() !== "n/a") return subspace;
  return slot.slotId;
}

function stateForSlot(slot: Slot): string {
  return norm(slot.state) || "No state";
}

function toDate(value: WorkLog["date"]): Date | null {
  return value?.toDate?.() ?? null;
}

function toPastTense(activity: string): string {
  switch (activity) {
    case "Plant":
      return "Planted";
    case "Transplant":
      return "Transplanted";
    case "Fertilize":
      return "Fertilized";
    case "Amend":
      return "Amended";
    case "Flip":
      return "Flipped";
    case "Pick":
      return "Picked";
    case "Install":
      return "Installed";
    case "Prep for Spring":
      return "Prepped for Spring";
    default:
      return activity;
  }
}

function groupHeaderName(
  plants: Plant[],
  slots: Slot[],
  workLogs: WorkLog[]
): { headingName: string; headingConflictNames: string[] } {
  const names = new Set<string>();
  for (const plant of plants) {
    const name = norm(plant.name);
    if (name) names.add(name);
  }
  if (names.size === 0) {
    for (const slot of slots) {
      const name = norm(slot.plantName);
      if (name) names.add(name);
    }
  }
  if (names.size === 0) {
    for (const log of workLogs) {
      const name = norm(log.plantName);
      if (name) names.add(name);
    }
  }
  const list = [...names].sort((a, b) => a.localeCompare(b));
  return {
    headingName: list[0] ?? "Unknown plant",
    headingConflictNames: list.slice(1),
  };
}

function matchesQueryByName(
  queryLower: string,
  name: string | null | undefined
): boolean {
  return queryLower.length > 0 && norm(name).toLowerCase().includes(queryLower);
}

function matchesPlantNumberQuery(
  query: string,
  plantNumber: string | null | undefined
): boolean {
  return plantNumberMatchesQuery(query, norm(plantNumber));
}

type LookupSeed = {
  baseNumber: string;
  plantInstances: Set<string>;
};

export function getPlantLookupSeeds(
  plants: Plant[],
  slots: Slot[],
  query: string
): LookupSeed[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const queryLower = trimmed.toLowerCase();
  const byBase = new Map<string, Set<string>>();
  const include = (instanceNumber: string) => {
    const base = getPlantBaseNumber(instanceNumber);
    if (!base) return;
    const next = byBase.get(base) ?? new Set<string>();
    next.add(instanceNumber);
    byBase.set(base, next);
  };

  for (const plant of plants) {
    if (
      matchesPlantNumberQuery(trimmed, plant.number) ||
      matchesQueryByName(queryLower, plant.name)
    ) {
      include(plant.number);
    }
  }
  for (const slot of slots) {
    if (!slot.plantNumber) continue;
    if (
      matchesPlantNumberQuery(trimmed, slot.plantNumber) ||
      matchesQueryByName(queryLower, slot.plantName)
    ) {
      include(slot.plantNumber);
    }
  }

  return [...byBase.entries()]
    .map(([baseNumber, instances]) => ({
      baseNumber,
      plantInstances: instances,
    }))
    .sort((a, b) => a.baseNumber.localeCompare(b.baseNumber));
}

export function queryLookupPlants(
  plants: Plant[],
  slots: Slot[],
  workLogs: WorkLog[],
  query: string
): PlantLookupResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { showResults: false, groups: [] };
  }

  const queryLower = trimmed.toLowerCase();
  const seeds = getPlantLookupSeeds(plants, slots, trimmed);
  const seedByBase = new Map(
    seeds.map((seed) => [seed.baseNumber, new Set(seed.plantInstances)])
  );
  for (const log of workLogs) {
    const instanceNumber = norm(log.plantNumber);
    if (!instanceNumber) continue;
    if (
      !matchesPlantNumberQuery(trimmed, instanceNumber) &&
      !matchesQueryByName(queryLower, log.plantName)
    ) {
      continue;
    }
    const base = getPlantBaseNumber(instanceNumber);
    if (!base) continue;
    const next = seedByBase.get(base) ?? new Set<string>();
    next.add(instanceNumber);
    seedByBase.set(base, next);
  }

  const combinedSeeds = [...seedByBase.entries()]
    .map(([baseNumber, plantInstances]) => ({ baseNumber, plantInstances }))
    .sort((a, b) => a.baseNumber.localeCompare(b.baseNumber));
  const groups: PlantLookupGroup[] = [];

  for (const seed of combinedSeeds) {
    const filteredSlots = slots.filter((slot) => {
      const instanceNumber = norm(slot.plantNumber);
      if (!instanceNumber) return false;
      if (getPlantBaseNumber(instanceNumber) !== seed.baseNumber) return false;
      return matchesPlantNumberQuery(trimmed, instanceNumber);
    });

    const filteredWorkLogs = workLogs.filter((log) => {
      const instanceNumber = norm(log.plantNumber);
      if (!instanceNumber) return false;
      if (getPlantBaseNumber(instanceNumber) !== seed.baseNumber) return false;
      return matchesPlantNumberQuery(trimmed, instanceNumber);
    });

    const relatedPlants = plants.filter(
      (plant) => getPlantBaseNumber(plant.number) === seed.baseNumber
    );
    const header = groupHeaderName(relatedPlants, filteredSlots, filteredWorkLogs);

    const stateMap = new Map<
      string,
      Map<string, Array<{ plantInstance: string; slotId: string }>>
    >();
    for (const slot of filteredSlots) {
      const stateLabel = stateForSlot(slot);
      const locationLabel = locationForSlot(slot);
      const plantInstance = norm(slot.plantNumber);
      const perState = stateMap.get(stateLabel) ?? new Map();
      const perLocation = perState.get(locationLabel) ?? [];
      perLocation.push({ plantInstance, slotId: slot.slotId });
      perState.set(locationLabel, perLocation);
      stateMap.set(stateLabel, perState);
    }

    const stateGroups = [...stateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stateLabel, locations]) => {
        const locationGroups = [...locations.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([locationLabel, instances]) => ({
            locationLabel,
            instances: [...instances].sort((a, b) =>
              a.plantInstance.localeCompare(b.plantInstance)
            ),
          }));
        return {
          stateLabel,
          locationGroups,
          hasMultipleLocations: locationGroups.length > 1,
        };
      });

    const workLogSummary = [...filteredWorkLogs]
      .sort((a, b) => {
        const aDate = toDate(a.date)?.getTime() ?? 0;
        const bDate = toDate(b.date)?.getTime() ?? 0;
        return bDate - aDate;
      })
      .map((log) => ({
        id: log.id,
        plantInstance: log.plantNumber,
        date: toDate(log.date),
        activity: log.activity,
        activityLabel: toPastTense(log.activity),
        slotLabel: PLANTING_ACTIVITIES.has(log.activity) ? log.slotId : null,
      }));

    groups.push({
      baseNumber: seed.baseNumber,
      headingName: header.headingName,
      headingConflictNames: header.headingConflictNames,
      stateGroups,
      workLogSummary,
    });
  }

  return { showResults: true, groups };
}
