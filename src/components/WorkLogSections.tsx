import { useMemo } from "react";
import { format } from "date-fns";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkLog } from "@/lib/types";

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
            {(groupedLogs.get(key) ?? []).map((log) => (
              <li
                key={log.id}
                className="py-2 first:pt-0 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    {log.date?.toDate?.() ? format(log.date.toDate(), "M/d/yyyy") : "—"}{" "}
                    — {log.activity}
                    {anchor === "plant" && log.slotId && (
                      <span className="text-muted-foreground ml-1">@ {log.slotId}</span>
                    )}
                    {anchor === "slot" && (
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
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDeleteWorklog(log)}
                  aria-label={`Delete work log: ${log.activity} ${log.date?.toDate?.() ? format(log.date.toDate(), "M/d/yyyy") : ""}`}
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
