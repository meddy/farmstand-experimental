import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSlots } from "@/hooks/useSlots";
import { usePlants } from "@/hooks/usePlants";
import { plantNumberMatchesPrefix } from "@/lib/utils";
import { SPACE_TYPES, type SpaceType } from "@/lib/types";
import type { Slot } from "@/lib/types";

const HAS_SUBSPACE: SpaceType[] = ["Trough", "Bin"];
const ALL_SUBSPACES = "__all__";
const ALL_SPACES = "__all__";

type SortField = "slotId" | "lastChange";
type SortDirection = "asc" | "desc";

function slotsMatchingPlant(
  slots: Slot[],
  plants: { number: string; name?: string }[],
  query: string
): Slot[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const results: Slot[] = [];
  const nameLower = trimmed.toLowerCase();

  // 1. Slots with plantNumber prefix match
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

  // 2. Plants whose number starts with query → slots via plantNumber
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

  // 3. Plant name contains query → slots
  const byName = plants.filter((p) => p.name?.toLowerCase().includes(nameLower));
  for (const plant of byName) {
    for (const slot of slots) {
      if (slot.plantNumber === plant.number && !seen.has(slot.id)) {
        seen.add(slot.id);
        results.push(slot);
      }
    }
  }

  // 4. Slots with plantName containing query (no plant in collection)
  for (const slot of slots) {
    if (slot.plantName?.toLowerCase().includes(nameLower) && !seen.has(slot.id)) {
      seen.add(slot.id);
      results.push(slot);
    }
  }

  return results;
}

export function LookupSlots() {
  const slots = useSlots();
  const plants = usePlants();
  const [spaceType, setSpaceType] = useState<SpaceType | null>(null);
  const [subspace, setSubspace] = useState<string>(ALL_SUBSPACES);
  const [plantQuery, setPlantQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("slotId");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const subspaces = useMemo(() => {
    if (!spaceType || !HAS_SUBSPACE.includes(spaceType)) return [];
    const set = new Set<string>();
    slots
      .filter((s) => s.spaceType === spaceType && s.subspace)
      .forEach((s) => set.add(s.subspace!));
    return Array.from(set).toSorted();
  }, [slots, spaceType]);

  const filteredSlots = useMemo(() => {
    const hasSpaceFilter = spaceType !== null;
    const hasPlantFilter = plantQuery.trim().length > 0;

    if (!hasSpaceFilter && !hasPlantFilter) return [];

    let list: Slot[];

    if (hasSpaceFilter && hasPlantFilter) {
      const spaceFiltered = slots.filter((s) => s.spaceType === spaceType!);
      const subspaceFiltered =
        HAS_SUBSPACE.includes(spaceType!) && subspace !== ALL_SUBSPACES
          ? spaceFiltered.filter((s) => s.subspace === subspace)
          : spaceFiltered;
      list = slotsMatchingPlant(subspaceFiltered, plants, plantQuery);
    } else if (hasSpaceFilter) {
      list = slots.filter((s) => s.spaceType === spaceType!);
      if (HAS_SUBSPACE.includes(spaceType!) && subspace !== ALL_SUBSPACES) {
        list = list.filter((s) => s.subspace === subspace);
      }
    } else {
      list = slotsMatchingPlant(slots, plants, plantQuery);
    }

    const getLastChangeTime = (s: Slot) => s.lastChange?.toDate?.()?.getTime() ?? 0;

    return [...list].sort((a, b) => {
      if (sortField === "slotId") {
        const cmp = a.slotId.localeCompare(b.slotId);
        return sortDirection === "asc" ? cmp : -cmp;
      }
      const aTime = getLastChangeTime(a);
      const bTime = getLastChangeTime(b);
      const cmp = aTime - bTime;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [slots, plants, spaceType, subspace, plantQuery, sortField, sortDirection]);

  const showSubspace = spaceType !== null && HAS_SUBSPACE.includes(spaceType);
  const showResults = spaceType !== null || plantQuery.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Lookup Slots</h2>
        <p className="text-sm text-muted-foreground">
          Select a space type or search by plant name/number. Slots appear when at least
          one filter has a value.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Space Type</label>
          <Select
            value={spaceType !== null ? spaceType : ALL_SPACES}
            onValueChange={(v) => {
              setSpaceType(v === ALL_SPACES ? null : (v as SpaceType));
              setSubspace(ALL_SUBSPACES);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SPACES}>All</SelectItem>
              {SPACE_TYPES.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showSubspace && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Subspace</label>
            <Select value={subspace} onValueChange={setSubspace}>
              <SelectTrigger>
                <SelectValue placeholder="All subspaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SUBSPACES}>All</SelectItem>
                {subspaces
                  .filter((s) => s)
                  .map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="plant-filter" className="text-sm font-medium">
            Filter by plant name or number
          </label>
          <Input
            id="plant-filter"
            placeholder="e.g. 92 or Rosemary"
            value={plantQuery}
            onChange={(e) => setPlantQuery(e.target.value)}
          />
        </div>

        {showResults && filteredSlots.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Sort by</label>
              <Select
                value={sortField}
                onValueChange={(v) => setSortField(v as SortField)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slotId">Slot name</SelectItem>
                  <SelectItem value="lastChange">Last change</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Order</label>
              <Select
                value={sortDirection}
                onValueChange={(v) => setSortDirection(v as SortDirection)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Slots</label>
          <div className="divide-y rounded-md border">
            {!showResults ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Select a space type or enter a plant name/number to see slots
              </div>
            ) : filteredSlots.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No slots found
              </div>
            ) : (
              filteredSlots.map((slot) => {
                const showLinks = slot.spaceType !== "Bin";
                return (
                  <div key={slot.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="font-medium">
                      {showLinks ? (
                        <Link
                          to={`/slot/${slot.id}`}
                          className="text-primary hover:underline"
                        >
                          {slot.slotId}
                        </Link>
                      ) : (
                        slot.slotId
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {slot.state ?? "—"}
                      {slot.plantName && (
                        <span className="ml-2">
                          •
                          {showLinks && slot.plantNumber ? (
                            <Link
                              to={`/plant/${encodeURIComponent(slot.plantNumber)}`}
                              className="ml-1 text-primary hover:underline"
                            >
                              {slot.plantName}
                              {slot.plantNumber && ` (${slot.plantNumber})`}
                            </Link>
                          ) : (
                            <span className="ml-1">
                              {slot.plantName}
                              {slot.plantNumber && ` (${slot.plantNumber})`}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {slot.subspace && slot.subspace !== "n/a"
                        ? slot.subspace
                        : slot.spaceType}
                    </div>
                    {slot.lastChange && (
                      <div className="text-xs text-muted-foreground">
                        Last change:{" "}
                        {slot.lastChange.toDate
                          ? format(slot.lastChange.toDate(), "M/d/yyyy") +
                            (slot.lastActivity ? ` — ${slot.lastActivity}` : "")
                          : "—"}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
