import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { usePlants } from "@/hooks/usePlants";
import { useWorkLogsByPlant } from "@/hooks/useWorkLogsByPlant";
import { groupWorkLogsByYearQuarter } from "@/lib/utils";
import type { WorkLog } from "@/lib/types";

export function PlantDetail() {
  const { plantNumber } = useParams<{ plantNumber: string }>();
  const decodedNumber = plantNumber ? decodeURIComponent(plantNumber) : "";
  const plants = usePlants();
  const workLogs = useWorkLogsByPlant(decodedNumber);

  const plant = useMemo(
    () => plants.find((p) => p.number === decodedNumber),
    [plants, decodedNumber]
  );

  const groupedLogs = useMemo(() => groupWorkLogsByYearQuarter(workLogs), [workLogs]);

  if (!decodedNumber) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No plant number specified
        </CardContent>
      </Card>
    );
  }

  if (!plant) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Plant not found</h2>
          <p className="text-sm text-muted-foreground">
            No plant with number "{decodedNumber}" in the plants collection
          </p>
        </CardHeader>
        <CardContent>
          {workLogs.length > 0 ? (
            <WorkLogSections groupedLogs={groupedLogs} />
          ) : (
            <p className="text-sm text-muted-foreground">No work log records</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{plant.name}</h2>
          {plant.scientificName && (
            <p className="text-sm italic text-muted-foreground">
              {plant.scientificName}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Plant #{plant.number}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Work log history</h3>
            {workLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work log records</p>
            ) : (
              <WorkLogSections groupedLogs={groupedLogs} />
            )}
          </div>
          <Link to="/lookup-plant" className="text-sm text-primary hover:underline">
            ← Back to lookup
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkLogSections({ groupedLogs }: { groupedLogs: Map<string, WorkLog[]> }) {
  const sortedKeys = useMemo(
    () =>
      [...groupedLogs.keys()].sort((a, b) => {
        const [aYear, aQ] = a.split("-Q").map(Number);
        const [bYear, bQ] = b.split("-Q").map(Number);
        if (aYear !== bYear) return bYear - aYear;
        return bQ - aQ;
      }),
    [groupedLogs]
  );

  return (
    <div className="space-y-4">
      {sortedKeys.map((key) => (
        <div key={key}>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">{key}</h4>
          <ul className="space-y-2 divide-y">
            {(groupedLogs.get(key) ?? []).map((log) => (
              <li key={log.id} className="py-2 first:pt-0">
                <div className="text-sm">
                  {log.date?.toDate?.() ? format(log.date.toDate(), "M/d/yyyy") : "—"} —{" "}
                  {log.activity}
                  {log.slotId && (
                    <span className="text-muted-foreground ml-1">@ {log.slotId}</span>
                  )}
                </div>
                {log.notes && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {log.notes}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
