import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlants } from "@/hooks/usePlants";
import { useSlots } from "@/hooks/useSlots";
import { useWorkLogsByPlantBaseNumbers } from "@/hooks/useWorkLogsByPlantBaseNumbers";
import { getPlantLookupSeeds, queryLookupPlants } from "@/lib/plantLookupEngine";

const LOOKUP_PLANTS_FILTERS_KEY = "lookupPlantsFilters";

type PersistedFilters = {
  plantQuery: string;
};

function loadPersistedFilters(): Partial<PersistedFilters> | null {
  try {
    const raw = sessionStorage.getItem(LOOKUP_PLANTS_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedFilters;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function LookupPlants() {
  const plants = usePlants();
  const slots = useSlots();
  const [plantQuery, setPlantQuery] = useState(() => {
    const persisted = loadPersistedFilters();
    return typeof persisted?.plantQuery === "string" ? persisted.plantQuery : "";
  });

  const seeds = useMemo(
    () => getPlantLookupSeeds(plants, slots, plantQuery),
    [plants, slots, plantQuery]
  );
  const baseNumbers = useMemo(() => seeds.map((seed) => seed.baseNumber), [seeds]);
  const workLogs = useWorkLogsByPlantBaseNumbers(baseNumbers);

  const result = useMemo(
    () => queryLookupPlants(plants, slots, workLogs, plantQuery),
    [plants, slots, workLogs, plantQuery]
  );

  useEffect(() => {
    sessionStorage.setItem(
      LOOKUP_PLANTS_FILTERS_KEY,
      JSON.stringify({
        plantQuery,
      })
    );
  }, [plantQuery]);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Lookup Plants</h2>
        <p className="text-sm text-muted-foreground">
          Search by plant name, plant number, or plant instance.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="plant-filter" className="text-sm font-medium">
            Filter by plant name or number
          </label>
          <Input
            id="plant-filter"
            placeholder="e.g. 9382 or Oregano"
            value={plantQuery}
            onChange={(event) => setPlantQuery(event.target.value)}
          />
        </div>

        <hr className="my-4 border-border" />

        {!result.showResults ? (
          <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
            Enter a plant name or number to see matching plants
          </div>
        ) : result.groups.length === 0 ? (
          <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
            No plants found
          </div>
        ) : (
          <div className="space-y-4">
            {result.groups.map((group) => (
              <div key={group.baseNumber} className="rounded-md border">
                <div className="border-b px-4 py-3">
                  <div className="font-medium">
                    {group.baseNumber}: {group.headingName}
                  </div>
                  {group.headingConflictNames.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Multiple names: {group.headingConflictNames.join(", ")}
                    </div>
                  )}
                </div>

                <div className="space-y-4 px-4 py-3">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Current slots by state</h3>
                    {group.stateGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No current slots found
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {group.stateGroups.map((stateGroup) => (
                          <div key={stateGroup.stateLabel} className="space-y-2">
                            <h4 className="text-sm font-medium">
                              {stateGroup.stateLabel}
                            </h4>
                            <div className="space-y-2 pl-3">
                              {stateGroup.locationGroups.map((locationGroup) => (
                                <div
                                  key={`${stateGroup.stateLabel}-${locationGroup.locationLabel}`}
                                >
                                  {stateGroup.hasMultipleLocations && (
                                    <h5 className="text-xs font-medium text-muted-foreground mb-1">
                                      {locationGroup.locationLabel}
                                    </h5>
                                  )}
                                  <ul className="space-y-1">
                                    {locationGroup.instances.map((instance) => (
                                      <li
                                        key={`${instance.slotId}-${instance.plantInstance}`}
                                        className="text-sm text-muted-foreground"
                                      >
                                        <Link
                                          to={`/plant/${encodeURIComponent(instance.plantInstance)}`}
                                          className="text-primary hover:underline"
                                        >
                                          {instance.plantInstance}
                                        </Link>{" "}
                                        - {locationGroup.locationLabel}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Work log summary</h3>
                    {group.workLogSummary.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No historical work logs found
                      </p>
                    ) : (
                      <ul className="space-y-1 divide-y">
                        {group.workLogSummary.map((log) => (
                          <li
                            key={log.id}
                            className="py-1 text-sm text-muted-foreground"
                          >
                            {log.activityLabel} {log.plantInstance ?? "Unknown"} on{" "}
                            {log.date ? format(log.date, "M/d/yyyy") : "—"}
                            {log.slotLabel ? ` in ${log.slotLabel}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
