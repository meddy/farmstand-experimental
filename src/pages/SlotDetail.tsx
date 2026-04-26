import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, PencilIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CreateWorkLogForm } from "@/components/CreateWorkLogForm";
import { EditSlotForm } from "@/components/EditSlotForm";
import { WorkLogSections } from "@/components/WorkLogSections";
import { getSlotById, getSlotIdsForSubspace } from "@/lib/firestore";
import { cascadeDeleteSlot, deleteWorkLogEntry } from "@/lib/entityCascadeDelete";
import { useWorkLogsBySlotIds } from "@/hooks/useWorkLogsBySlotIds";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { groupWorkLogsByYearQuarter } from "@/lib/utils";
import type { Slot, WorkLog } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function SlotDetail() {
  const { slotDocId } = useParams<{ slotDocId: string }>();
  const navigate = useNavigate();
  const [slot, setSlot] = useState<Slot | null | "loading">("loading");
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [deleteSlotDialogOpen, setDeleteSlotDialogOpen] = useState(false);
  const [deleteWorklogDialogOpen, setDeleteWorklogDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [workLogDialogOpen, setWorkLogDialogOpen] = useState(false);
  const [worklogToDelete, setWorklogToDelete] = useState<WorkLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isDesktop = useMediaQuery("(min-width: 768px)");

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
  }, [slotDocId, refreshKey]);

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
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={() => setWorkLogDialogOpen(true)}
              disabled={isDeleting}
            >
              <ClipboardList className="size-4" />
              Create work log
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              disabled={isDeleting}
            >
              <PencilIcon />
              Edit slot
            </Button>
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

      {editDialogOpen && isDesktop && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit slot</DialogTitle>
            </DialogHeader>
            <EditSlotForm
              selectedSlots={[slot]}
              initialState={slot.state}
              initialPlantMode="set"
              onCancel={() => setEditDialogOpen(false)}
              onSuccess={() => {
                setEditDialogOpen(false);
                setRefreshKey((v) => v + 1);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {editDialogOpen && !isDesktop && (
        <Sheet open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <SheetContent
            side="bottom"
            className="h-[90dvh] max-h-[90dvh] overflow-y-auto rounded-t-xl"
          >
            <SheetHeader>
              <SheetTitle>Edit slot</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto pb-safe">
              <EditSlotForm
                selectedSlots={[slot]}
                initialState={slot.state}
                initialPlantMode="set"
                onCancel={() => setEditDialogOpen(false)}
                onSuccess={() => {
                  setEditDialogOpen(false);
                  setRefreshKey((v) => v + 1);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {workLogDialogOpen && isDesktop && (
        <Dialog open={workLogDialogOpen} onOpenChange={setWorkLogDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create work log</DialogTitle>
            </DialogHeader>
            <CreateWorkLogForm
              selectedSlots={[slot]}
              onCancel={() => setWorkLogDialogOpen(false)}
              onSuccess={() => {
                setWorkLogDialogOpen(false);
                setRefreshKey((v) => v + 1);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {workLogDialogOpen && !isDesktop && (
        <Sheet open={workLogDialogOpen} onOpenChange={setWorkLogDialogOpen}>
          <SheetContent
            side="bottom"
            className="h-[90dvh] max-h-[90dvh] overflow-y-auto rounded-t-xl"
          >
            <SheetHeader>
              <SheetTitle>Create work log</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto pb-safe">
              <CreateWorkLogForm
                selectedSlots={[slot]}
                onCancel={() => setWorkLogDialogOpen(false)}
                onSuccess={() => {
                  setWorkLogDialogOpen(false);
                  setRefreshKey((v) => v + 1);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Card>
  );
}
