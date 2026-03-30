import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { WorkLogSections } from "@/components/WorkLogSections";
import { usePlants } from "@/hooks/usePlants";
import { useWorkLogsByPlant } from "@/hooks/useWorkLogsByPlant";
import { cascadeDeletePlant, deleteWorkLogEntry } from "@/lib/entityCascadeDelete";
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
      await cascadeDeletePlant(plant);
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
