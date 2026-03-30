import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { WorkLogSections } from "@/components/WorkLogSections";
import { getSlotById, getSlotIdsForSubspace } from "@/lib/firestore";
import { cascadeDeleteSlot, deleteWorkLogEntry } from "@/lib/entityCascadeDelete";
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
      await cascadeDeleteSlot(slot);
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
      await deleteWorkLogEntry(log.id);
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
                anchor="slot"
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
