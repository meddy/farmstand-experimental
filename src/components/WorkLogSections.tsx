import { useMemo } from "react";
import { format } from "date-fns";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Activity, WorkLog } from "@/lib/types";

export type WorkLogListAnchor = "plant" | "slot";

export interface WorkLogSectionsProps {
  groupedLogs: Map<string, WorkLog[]>;
  onDeleteWorklog: (log: WorkLog) => void;
  /**
   * "plant": viewing a plant's logs — secondary text shows slot ("@ B01")
   * "slot": viewing a slot's logs — secondary text shows plant ("Rosemary #9382")
   */
  anchor?: WorkLogListAnchor;
}

const PAST_TENSE_ACTIVITY_LABELS: Partial<Record<Activity, string>> = {
  Plant: "Planted",
  Transplant: "Transplanted",
  Fertilize: "Fertilized",
  Flip: "Flipped",
  Pick: "Picked",
  Install: "Installed",
  "Prep for Spring": "Prepped for Spring",
  Amend: "Amended",
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDisplayActivity(activity: Activity, date: Date): string {
  const activityDay = startOfLocalDay(date).getTime();
  const today = startOfLocalDay(new Date()).getTime();
  if (activityDay < today) {
    return PAST_TENSE_ACTIVITY_LABELS[activity] ?? activity;
  }
  return activity;
}

export function WorkLogSections({
  groupedLogs,
  onDeleteWorklog,
  anchor = "plant",
}: WorkLogSectionsProps) {
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
            {(groupedLogs.get(key) ?? []).map((log) => {
              const logDate = log.date?.toDate?.();
              const displayActivity = logDate
                ? getDisplayActivity(log.activity, logDate)
                : log.activity;

              return (
                <li
                  key={log.id}
                  className="py-2 first:pt-0 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      {logDate ? format(logDate, "M/d/yyyy") : "—"} — {displayActivity}
                      {anchor === "plant" && log.slotId && (
                        <span className="text-muted-foreground ml-1">
                          @ {log.slotId}
                        </span>
                      )}
                      {anchor === "slot" && (
                        <span className="text-muted-foreground ml-1">
                          {log.plantName && log.plantNumber
                            ? `${log.plantName} #${log.plantNumber}`
                            : log.plantName || log.plantNumber || "No plant"}
                        </span>
                      )}
                    </div>
                    {log.notes && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {log.notes}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDeleteWorklog(log)}
                    aria-label={`Delete work log: ${displayActivity} ${logDate ? format(logDate, "M/d/yyyy") : ""}`}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
