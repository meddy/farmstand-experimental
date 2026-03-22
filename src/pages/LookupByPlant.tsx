import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSlots } from "@/hooks/useSlots";
import { usePlants } from "@/hooks/usePlants";
import { plantNumberMatchesPrefix } from "@/lib/utils";

export function LookupByPlant() {
  const plants = usePlants();
  const slots = useSlots();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const trimmed = query.trim();
    const seen = new Set<string>();
    const slotResults: typeof slots = [];

    // 1. Slots with plantNumber that starts with query (prefix match: e.g. "92" → 9200-9299.9)
    for (const slot of slots) {
      if (slot.plantNumber && plantNumberMatchesPrefix(trimmed, slot.plantNumber)) {
        if (!seen.has(slot.id)) {
          seen.add(slot.id);
          slotResults.push(slot);
        }
      }
    }

    // 2. Plants whose number starts with query → slots via plantNumber (plants not in slots yet)
    const matchingPlants = plants.filter((p) =>
      plantNumberMatchesPrefix(trimmed, p.number)
    );
    for (const plant of matchingPlants) {
      for (const slot of slots) {
        if (slot.plantNumber === plant.number && !seen.has(slot.id)) {
          seen.add(slot.id);
          slotResults.push(slot);
        }
      }
    }

    // 3. Plant name contains query (exact substring, no fuzzy)
    const nameLower = trimmed.toLowerCase();
    const byName = plants.filter((p) => p.name?.toLowerCase().includes(nameLower));
    for (const plant of byName) {
      for (const slot of slots) {
        if (slot.plantNumber === plant.number && !seen.has(slot.id)) {
          seen.add(slot.id);
          slotResults.push(slot);
        }
      }
    }

    // 4. Slots with plantName containing query (no plant in collection)
    for (const slot of slots) {
      if (slot.plantName?.toLowerCase().includes(nameLower) && !seen.has(slot.id)) {
        seen.add(slot.id);
        slotResults.push(slot);
      }
    }

    return slotResults;
  }, [query, plants, slots]);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Lookup by Plant</h2>
        <p className="text-sm text-muted-foreground">
          Search by plant name or number to find slot locations
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="plant-search" className="text-sm font-medium">
            Plant name or number
          </label>
          <Input
            id="plant-search"
            placeholder="e.g. 92 (matches 9200–9299.9) or Rosemary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Slot locations</label>
          <div className="divide-y rounded-md border">
            {!query.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Enter a plant name or number to search
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No slots found for this plant
              </div>
            ) : (
              results.map((slot) => (
                <div key={slot.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="font-medium">{slot.slotId}</div>
                  <div className="text-sm text-muted-foreground">
                    {slot.spaceType}
                    {slot.subspace ? ` • ${slot.subspace}` : ""}
                  </div>
                  {slot.plantName && (
                    <div className="text-sm">
                      {slot.plantName}
                      {slot.plantNumber && ` (${slot.plantNumber})`}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
