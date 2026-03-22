import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { usePlants } from "@/hooks/usePlants";
import { useWorkLogsByPlant } from "@/hooks/useWorkLogsByPlant";
import { getWorkLogsByPlantNumber, deletePlant, deleteWorkLog } from "@/lib/firestore";
import { groupWorkLogsByYearQuarter } from "@/lib/utils";
import type { WorkLog } from "@/lib/types";

export function PlantDetail() {
  const { plantNumber } = useParams<{ plantNumber: string }>();
  const navigate = useNavigate();
  const decodedNumber = plantNumber ? decodeURIComponent(plantNumber) : "";
  const plants = usePlants();
  const workLogs = useWorkLogsByPlant(decodedNumber);

  const [deletePlantDialogOpen, setDeletePlantDialogOpen] = useState(false);
  const [deleteWorklogDialogOpen, setDeleteWorklogDialogOpen] = useState(false);
  const [worklogToDelete, setWorklogToDelete] = useState<WorkLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const plant = useMemo(
    () => plants.find((p) => p.number === decodedNumber),
    [plants, decodedNumber]
  );

  const groupedLogs = useMemo(() => groupWorkLogsByYearQuarter(workLogs), [workLogs]);

  async function handleDeletePlant() {
    if (!plant) return;
    setIsDeleting(true);
    try {
      const logs = await getWorkLogsByPlantNumber(plant.number);
      await Promise.all(logs.map((log) => deleteWorkLog(log.id)));
      await deletePlant(plant.id);
      toast.success("Plant and work log entries deleted");
      navigate("/lookup");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete plant");
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
            <WorkLogSections
              groupedLogs={groupedLogs}
              onDeleteWorklog={(log) => {
                setWorklogToDelete(log);
                setDeleteWorklogDialogOpen(true);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No work log records</p>
          )}
        </CardContent>
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{plant.name}</h2>
            {plant.scientificName && (
              <p className="text-sm italic text-muted-foreground">
                {plant.scientificName}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Plant #{plant.number}</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setDeletePlantDialogOpen(true)}
            disabled={isDeleting}
          >
            <Trash2Icon />
            Delete plant
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
        open={deletePlantDialogOpen}
        onOpenChange={setDeletePlantDialogOpen}
        title="Delete plant"
        description={
          workLogs.length > 0
            ? `Delete this plant and its ${workLogs.length} work log entries? This cannot be undone.`
            : "Delete this plant? This cannot be undone."
        }
        onConfirm={handleDeletePlant}
        confirmLabel="Delete plant"
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
                      <span className="text-muted-foreground ml-1">@ {log.slotId}</span>
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
