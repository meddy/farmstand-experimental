import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSlotById, getSlotIdsForSubspace } from "@/lib/firestore";
import { useWorkLogsBySlotIds } from "@/hooks/useWorkLogsBySlotIds";
import { groupWorkLogsByYearQuarter } from "@/lib/utils";
import type { Slot, WorkLog } from "@/lib/types";

export function SlotDetail() {
  const { slotDocId } = useParams<{ slotDocId: string }>();
  const [slot, setSlot] = useState<Slot | null | "loading">("loading");
  const [slotIds, setSlotIds] = useState<string[]>([]);

  useEffect(() => {
    if (!slotDocId) {
      setSlot(null);
      setSlotIds([]);
      return;
    }
    const id: string = slotDocId;

    let cancelled = false;

    async function load() {
      const s = await getSlotById(id);
      if (cancelled) return;
      setSlot(s ?? null);

      if (!s) {
        setSlotIds([]);
        return;
      }

      const hasSubspace =
        (s.spaceType === "Trough" || s.spaceType === "Bin") &&
        s.subspace &&
        s.subspace !== "n/a";
      if (hasSubspace && s.subspace) {
        const ids = await getSlotIdsForSubspace(s.spaceType, s.subspace);
        if (!cancelled) setSlotIds(ids);
      } else {
        if (!cancelled) setSlotIds([s.slotId]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slotDocId]);

  const workLogs = useWorkLogsBySlotIds(slotIds);
  const groupedLogs = useMemo(() => groupWorkLogsByYearQuarter(workLogs), [workLogs]);

  if (!slotDocId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No slot specified
        </CardContent>
      </Card>
    );
  }

  if (slot === "loading") {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (!slot) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Slot not found</h2>
          <p className="text-sm text-muted-foreground">
            No slot with the given ID was found
          </p>
        </CardHeader>
        <CardContent>
          <Link to="/lookup-space" className="text-sm text-primary hover:underline">
            ← Back to lookup
          </Link>
        </CardContent>
      </Card>
    );
  }

  const locationLabel =
    slot.subspace && slot.subspace !== "n/a" ? slot.subspace : slot.spaceType;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{slot.slotId}</h2>
          <p className="text-sm text-muted-foreground">{locationLabel}</p>
          {slot.plantName && (
            <p className="text-sm">
              {slot.plantName}
              {slot.plantNumber && ` (${slot.plantNumber})`}
            </p>
          )}
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
          <Link to="/lookup-space" className="text-sm text-primary hover:underline">
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
                    <span className="text-muted-foreground ml-1">
                      {log.plantName} #{log.plantNumber}
                    </span>
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
