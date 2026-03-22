import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import {
  getSlotById,
  getSlotIdsForSubspace,
  getWorkLogsBySlotId,
  deleteSlot,
  deleteWorkLog,
} from "@/lib/firestore";
import { useWorkLogsBySlotIds } from "@/hooks/useWorkLogsBySlotIds";
import { groupWorkLogsByYearQuarter } from "@/lib/utils";
import type { Slot, WorkLog } from "@/lib/types";

export function SlotDetail() {
  const { slotDocId } = useParams<{ slotDocId: string }>();
  const navigate = useNavigate();
  const [slot, setSlot] = useState<Slot | null | "loading">("loading");
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [deleteSlotDialogOpen, setDeleteSlotDialogOpen] = useState(false);
  const [deleteWorklogDialogOpen, setDeleteWorklogDialogOpen] = useState(false);
  const [worklogToDelete, setWorklogToDelete] = useState<WorkLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const relatedWorklogsCount = useMemo(() => {
    if (!slot || slot === "loading") return 0;
    return workLogs.filter(
      (log) => log.slotId === slot.slotId && log.spaceType === slot.spaceType
    ).length;
  }, [slot, workLogs]);

  async function handleDeleteSlot() {
    if (!slot || slot === "loading") return;
    setIsDeleting(true);
    try {
      const logs = await getWorkLogsBySlotId(slot.slotId, slot.spaceType);
      await Promise.all(logs.map((log) => deleteWorkLog(log.id)));
      await deleteSlot(slot.id);
      toast.success("Slot and work log entries deleted");
      navigate("/lookup");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete slot");
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteWorklog(log: WorkLog) {
    setIsDeleting(true);
    try {
      await deleteWorkLog(log.id);
      toast.success("Work log entry deleted");
      setWorklogToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete work log");
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }

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
          <Link to="/lookup" className="text-sm text-primary hover:underline">
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
        <div className="flex items-start justify-between gap-4">
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
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setDeleteSlotDialogOpen(true)}
            disabled={isDeleting}
          >
            <Trash2Icon />
            Delete slot
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Work log history</h3>
            {workLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work log records</p>
            ) : (
              <WorkLogSections
                groupedLogs={groupedLogs}
                onDeleteWorklog={(log) => {
                  setWorklogToDelete(log);
                  setDeleteWorklogDialogOpen(true);
                }}
              />
            )}
          </div>
          <Link to="/lookup" className="text-sm text-primary hover:underline">
            ← Back to lookup
          </Link>
        </div>
      </CardContent>

      <ConfirmDeleteDialog
        open={deleteSlotDialogOpen}
        onOpenChange={setDeleteSlotDialogOpen}
        title="Delete slot"
        description={
          relatedWorklogsCount > 0
            ? `Delete this slot and its ${relatedWorklogsCount} work log entries? This cannot be undone.`
            : "Delete this slot? This cannot be undone."
        }
        onConfirm={handleDeleteSlot}
        confirmLabel="Delete slot"
        isLoading={isDeleting}
      />

      <ConfirmDeleteDialog
        open={deleteWorklogDialogOpen}
        onOpenChange={(open) => {
          setDeleteWorklogDialogOpen(open);
          if (!open) setWorklogToDelete(null);
        }}
        title="Delete work log"
        description="Delete this work log entry? This cannot be undone."
        onConfirm={async () => {
          if (worklogToDelete) await handleDeleteWorklog(worklogToDelete);
        }}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </Card>
  );
}

function WorkLogSections({
  groupedLogs,
  onDeleteWorklog,
}: {
  groupedLogs: Map<string, WorkLog[]>;
  onDeleteWorklog: (log: WorkLog) => void;
}) {
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
