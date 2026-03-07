import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSlots } from "@/hooks/useSlots";
import type { SpaceType } from "@/lib/types";
const SPACE_TYPES: SpaceType[] = ["Bucket", "Tray", "RaisedBed", "Bin"];

const HAS_SUBSPACE: SpaceType[] = ["RaisedBed", "Bin"];
const ALL_SUBSPACES = "__all__";

export function LookupBySpace() {
  const slots = useSlots();
  const [spaceType, setSpaceType] = useState<SpaceType>("Tray");
  const [subspace, setSubspace] = useState<string>(ALL_SUBSPACES);

  const subspaces = useMemo(() => {
    if (!HAS_SUBSPACE.includes(spaceType)) return [];
    const set = new Set<string>();
    slots
      .filter((s) => s.spaceType === spaceType && s.subspace)
      .forEach((s) => set.add(s.subspace!));
    return Array.from(set).toSorted();
  }, [slots, spaceType]);

  const filteredSlots = useMemo(() => {
    let list = slots.filter((s) => s.spaceType === spaceType);
    if (HAS_SUBSPACE.includes(spaceType) && subspace !== ALL_SUBSPACES) {
      list = list.filter((s) => s.subspace === subspace);
    }
    return list.toSorted((a, b) => a.slotId.localeCompare(b.slotId));
  }, [slots, spaceType, subspace]);

  const showSubspace = HAS_SUBSPACE.includes(spaceType);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Lookup by Space</h2>
        <p className="text-sm text-muted-foreground">
          Select a space type, then a subspace or slot to see plant info
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Space Type</label>
          <Select
            value={spaceType}
            onValueChange={(v) => {
              setSpaceType(v as SpaceType);
              setSubspace(ALL_SUBSPACES);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
                <SelectItem value={ALL_SUBSPACES}>All</SelectItem>
                {subspaces.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Slots</label>
          <div className="divide-y rounded-md border">
            {filteredSlots.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No slots found
              </div>
            ) : (
              filteredSlots.map((slot) => (
                <div key={slot.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="font-medium">{slot.slotId}</div>
                  <div className="text-sm text-muted-foreground">
                    {slot.state ?? "—"}
                    {slot.plantName && (
                      <span className="ml-2">
                        • {slot.plantName}
                        {slot.plantNumber && ` (${slot.plantNumber})`}
                      </span>
                    )}
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
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
