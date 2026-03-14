import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSlots } from "@/hooks/useSlots";
import { usePlants } from "@/hooks/usePlants";

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const t = text.toLowerCase();
  let j = 0;
  for (let i = 0; i < t.length && j < q.length; i++) {
    if (t[i] === q[j]) j++;
  }
  return j === q.length;
}

export function LookupByPlant() {
  const plants = usePlants();
  const slots = useSlots();
  const [query, setQuery] = useState("");

  const plantNumberToSlots = useMemo(() => {
    const map = new Map<string, typeof slots>();
    for (const slot of slots) {
      if (slot.plantNumber) {
        const list = map.get(slot.plantNumber) ?? [];
        list.push(slot);
        map.set(slot.plantNumber, list);
      }
    }
    return map;
  }, [slots]);

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const trimmed = query.trim();
    const seen = new Set<string>();

    // 1. Direct plant number lookup
    const byNumber = plantNumberToSlots.get(trimmed);
    if (byNumber && byNumber.length > 0) {
      return byNumber;
    }

    // 2. Plants collection → slots via plantNumber
    const matchingPlants = plants.filter(
      (p) =>
        p.number.toLowerCase().includes(trimmed.toLowerCase()) ||
        fuzzyMatch(trimmed, p.name)
    );

    const slotResults: typeof slots = [];
    for (const plant of matchingPlants) {
      const s = plantNumberToSlots.get(plant.number);
      if (s) {
        for (const slot of s) {
          if (!seen.has(slot.id)) {
            seen.add(slot.id);
            slotResults.push(slot);
          }
        }
      }
    }

    // 3. Direct slot.plantName search (finds slots with name but no/mismatched plantNumber)
    const matchingSlots = slots.filter(
      (s) => s.plantName && fuzzyMatch(trimmed, s.plantName)
    );
    for (const slot of matchingSlots) {
      if (!seen.has(slot.id)) {
        seen.add(slot.id);
        slotResults.push(slot);
      }
    }

    return slotResults;
  }, [query, plants, plantNumberToSlots, slots]);

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
            placeholder="e.g. Rosemary or 9382.1"
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
