import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ClipboardList, PencilIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSlots } from "@/hooks/useSlots";
import { usePlants } from "@/hooks/usePlants";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  queryLookupSlots,
  SLOT_LOOKUP_ALL_SUBSPACES,
  type SlotLookupSortDirection,
  type SlotLookupSortField,
} from "@/lib/slotQueryEngine";
import { SPACE_TYPES, type SpaceType } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CreateWorkLogForm } from "@/components/CreateWorkLogForm";
import { EditSlotForm } from "@/components/EditSlotForm";

const ALL_SPACES = "__all__";

const LOOKUP_SLOTS_FILTERS_KEY = "lookupSlotsFilters";

type PersistedFilters = {
  spaceType: SpaceType | string; // "__none__" for null
  subspace: string;
  plantQuery: string;
  sortField: SlotLookupSortField;
  sortDirection: SlotLookupSortDirection;
};

const SORT_FIELDS: SlotLookupSortField[] = ["slotId", "lastChange"];
const SORT_DIRECTIONS: SlotLookupSortDirection[] = ["asc", "desc"];

function loadPersistedFilters(): Partial<PersistedFilters> | null {
  try {
    const raw = sessionStorage.getItem(LOOKUP_SLOTS_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedFilters;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function LookupSlots() {
  const slots = useSlots();
  const plants = usePlants();
  const [spaceType, setSpaceType] = useState<SpaceType | null>(() => {
    const p = loadPersistedFilters();
    if (
      p?.spaceType &&
      p.spaceType !== "__none__" &&
      SPACE_TYPES.includes(p.spaceType as SpaceType)
    )
      return p.spaceType as SpaceType;
    return null;
  });
  const [subspace, setSubspace] = useState<string>(() => {
    const p = loadPersistedFilters();
    return typeof p?.subspace === "string" ? p.subspace : SLOT_LOOKUP_ALL_SUBSPACES;
  });
  const [plantQuery, setPlantQuery] = useState(() => {
    const p = loadPersistedFilters();
    return typeof p?.plantQuery === "string" ? p.plantQuery : "";
  });
  const [sortField, setSortField] = useState<SlotLookupSortField>(() => {
    const p = loadPersistedFilters();
    return p?.sortField && SORT_FIELDS.includes(p.sortField) ? p.sortField : "slotId";
  });
  const [sortDirection, setSortDirection] = useState<SlotLookupSortDirection>(() => {
    const p = loadPersistedFilters();
    return p?.sortDirection && SORT_DIRECTIONS.includes(p.sortDirection)
      ? p.sortDirection
      : "asc";
  });
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
  const [workLogFormOpen, setWorkLogFormOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const toggleSlotSelection = useCallback((slotId: string) => {
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }, []);

  const { filteredSlots, subspaceOptions, showSubspace, showResults } = useMemo(
    () =>
      queryLookupSlots(slots, plants, {
        spaceType,
        subspace,
        plantQuery,
        sortField,
        sortDirection,
      }),
    [slots, plants, spaceType, subspace, plantQuery, sortField, sortDirection]
  );

  const selectedSlots = useMemo(
    () => filteredSlots.filter((s) => selectedSlotIds.has(s.id)),
    [filteredSlots, selectedSlotIds]
  );
  const visibleSlotIds = useMemo(
    () => filteredSlots.map((slot) => slot.id),
    [filteredSlots]
  );
  const visibleSelectedCount = useMemo(
    () => visibleSlotIds.filter((id) => selectedSlotIds.has(id)).length,
    [visibleSlotIds, selectedSlotIds]
  );
  const allVisibleSelected =
    visibleSlotIds.length > 0 && visibleSelectedCount === visibleSlotIds.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < visibleSlotIds.length;

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleFormSuccess = useCallback(() => {
    setWorkLogFormOpen(false);
    setEditFormOpen(false);
    setSelectedSlotIds(new Set());
  }, []);

  const handleFormCancel = useCallback(() => {
    setWorkLogFormOpen(false);
    setEditFormOpen(false);
  }, []);

  const toggleAllVisibleSlots = useCallback(() => {
    if (visibleSlotIds.length === 0) return;
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleSlotIds.forEach((id) => next.delete(id));
      } else {
        visibleSlotIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleSlotIds, allVisibleSelected]);

  useEffect(() => {
    if ((workLogFormOpen || editFormOpen) && selectedSlots.length === 0) {
      setWorkLogFormOpen(false);
      setEditFormOpen(false);
    }
  }, [workLogFormOpen, editFormOpen, selectedSlots.length]);

  useEffect(() => {
    setSelectedSlotIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIdSet = new Set(visibleSlotIds);
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIdSet.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [visibleSlotIds]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    sessionStorage.setItem(
      LOOKUP_SLOTS_FILTERS_KEY,
      JSON.stringify({
        spaceType: spaceType ?? "__none__",
        subspace,
        plantQuery,
        sortField,
        sortDirection,
      })
    );
  }, [spaceType, subspace, plantQuery, sortField, sortDirection]);

  const workLogFormContent =
    workLogFormOpen && selectedSlots.length > 0 ? (
      <CreateWorkLogForm
        selectedSlots={selectedSlots}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    ) : null;

  const editFormContent =
    editFormOpen && selectedSlots.length > 0 ? (
      <EditSlotForm
        selectedSlots={selectedSlots}
        initialPlantMode="leave"
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    ) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Lookup Slots</h2>
          <p className="text-sm text-muted-foreground">
            Select a space type or search by plant name/number. Slots appear when at
            least one filter has a value.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Space Type</label>
            <Select
              value={spaceType !== null ? spaceType : ALL_SPACES}
              onValueChange={(v) => {
                setSpaceType(v === ALL_SPACES ? null : (v as SpaceType));
                setSubspace(SLOT_LOOKUP_ALL_SUBSPACES);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SPACES}>All</SelectItem>
                {SPACE_TYPES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showSubspace && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Subspace</label>
              <Select value={subspace} onValueChange={setSubspace}>
                <SelectTrigger>
                  <SelectValue placeholder="All subspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SLOT_LOOKUP_ALL_SUBSPACES}>All</SelectItem>
                  {subspaceOptions
                    .filter((s) => s)
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="plant-filter" className="text-sm font-medium">
              Filter by plant name or number
            </label>
            <Input
              id="plant-filter"
              placeholder="e.g. 92 or Rosemary"
              value={plantQuery}
              onChange={(e) => setPlantQuery(e.target.value)}
            />
          </div>

          {showResults && filteredSlots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Sort by</label>
                <Select
                  value={sortField}
                  onValueChange={(v) => setSortField(v as SlotLookupSortField)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slotId">Slot name</SelectItem>
                    <SelectItem value="lastChange">Last change</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Order</label>
                <Select
                  value={sortDirection}
                  onValueChange={(v) => setSortDirection(v as SlotLookupSortDirection)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <hr className="my-4 border-border" />

          {selectedSlots.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button onClick={() => setWorkLogFormOpen(true)} className="w-full gap-2">
                <ClipboardList className="size-4" />
                Create work log ({selectedSlots.length} slot
                {selectedSlots.length !== 1 ? "s" : ""})
              </Button>
              <Button
                onClick={() => setEditFormOpen(true)}
                variant="outline"
                className="w-full gap-2"
              >
                <PencilIcon className="size-4" />
                Edit slots ({selectedSlots.length})
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">Slots</label>
              {showResults && filteredSlots.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleSlots}
                    className="size-4 rounded border-input"
                    aria-label="Select all shown slots"
                  />
                  <span>Select all {filteredSlots.length} shown</span>
                </label>
              )}
            </div>
            <div className="divide-y rounded-md border">
              {!showResults ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Select a space type or enter a plant name/number to see slots
                </div>
              ) : filteredSlots.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No slots found
                </div>
              ) : (
                filteredSlots.map((slot) => {
                  const showLinks = slot.spaceType !== "Bin";
                  const isSelected = selectedSlotIds.has(slot.id);
                  return (
                    <div key={slot.id} className="flex items-start gap-3 px-4 py-3">
                      <label className="flex shrink-0 items-center pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSlotSelection(slot.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="size-4 rounded border-input"
                        />
                        <span className="sr-only">Select {slot.slotId}</span>
                      </label>
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <div className="font-medium">
                          {showLinks ? (
                            <Link
                              to={`/slot/${slot.id}`}
                              className="text-primary hover:underline"
                            >
                              {slot.slotId}
                            </Link>
                          ) : (
                            slot.slotId
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {slot.state ?? "—"}
                          {slot.plantName && (
                            <span className="ml-2">
                              •
                              {showLinks && slot.plantNumber ? (
                                <Link
                                  to={`/plant/${encodeURIComponent(slot.plantNumber)}`}
                                  className="ml-1 text-primary hover:underline"
                                >
                                  {slot.plantName}
                                  {slot.plantNumber && ` (${slot.plantNumber})`}
                                </Link>
                              ) : (
                                <span className="ml-1">
                                  {slot.plantName}
                                  {slot.plantNumber && ` (${slot.plantNumber})`}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {slot.subspace && slot.subspace !== "n/a"
                            ? slot.subspace
                            : slot.spaceType}
                        </div>
                        {slot.lastChange && (
                          <div className="text-xs text-muted-foreground">
                            Last change:{" "}
                            {slot.lastChange.toDate
                              ? format(slot.lastChange.toDate(), "M/d/yyyy") +
                                (slot.lastActivity ? ` — ${slot.lastActivity}` : "")
                              : "—"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {workLogFormOpen && selectedSlots.length > 0 && isDesktop && (
        <Dialog
          open={workLogFormOpen}
          onOpenChange={(open) => !open && handleFormCancel()}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create work log</DialogTitle>
            </DialogHeader>
            {workLogFormContent}
          </DialogContent>
        </Dialog>
      )}

      {workLogFormOpen && selectedSlots.length > 0 && !isDesktop && (
        <Sheet
          open={workLogFormOpen}
          onOpenChange={(open) => !open && handleFormCancel()}
        >
          <SheetContent
            side="bottom"
            className="h-[90dvh] max-h-[90dvh] overflow-y-auto rounded-t-xl"
          >
            <SheetHeader>
              <SheetTitle>Create work log</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto pb-safe">{workLogFormContent}</div>
          </SheetContent>
        </Sheet>
      )}

      {editFormOpen && selectedSlots.length > 0 && isDesktop && (
        <Dialog
          open={editFormOpen}
          onOpenChange={(open) => !open && handleFormCancel()}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit slots</DialogTitle>
            </DialogHeader>
            {editFormContent}
          </DialogContent>
        </Dialog>
      )}

      {editFormOpen && selectedSlots.length > 0 && !isDesktop && (
        <Sheet open={editFormOpen} onOpenChange={(open) => !open && handleFormCancel()}>
          <SheetContent
            side="bottom"
            className="h-[90dvh] max-h-[90dvh] overflow-y-auto rounded-t-xl"
          >
            <SheetHeader>
              <SheetTitle>Edit slots</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto pb-safe">{editFormContent}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
