import { format } from "date-fns";
import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addWorkLog } from "@/hooks/useWorkLogs";
import { usePlants } from "@/hooks/usePlants";
import { cn, plantNumberMatchesPrefix } from "@/lib/utils";
import { ACTIVITIES, type Activity } from "@/lib/types";
import { isValidTransition } from "@/lib/transitions";
import { getSlotConflict } from "@/lib/workLogValidation";
import type { Slot } from "@/lib/types";
import { toast } from "sonner";

const schema = z.object({
  plantNumber: z.string().min(1, "Plant number or name required"),
  plantName: z.string().min(1, "Plant name required"),
  date: z.date(),
  activity: z.enum(ACTIVITIES as unknown as [string, ...string[]]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function getValidActivities(slots: Slot[]): Activity[] {
  const union = new Set<Activity>();
  for (const slot of slots) {
    for (const a of ACTIVITIES) {
      if (isValidTransition(slot.state ?? null, a as Activity)) {
        union.add(a as Activity);
      }
    }
  }
  return Array.from(union);
}

function getActivityIntersection(slots: Slot[]): Activity[] {
  if (slots.length === 0) return [];
  let intersection = getValidActivities([slots[0]]);
  for (let i = 1; i < slots.length; i++) {
    const valid = new Set(getValidActivities([slots[i]]).map((a) => a as Activity));
    intersection = intersection.filter((a) => valid.has(a));
  }
  return intersection;
}

interface CreateWorkLogFormProps {
  selectedSlots: Slot[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateWorkLogForm({
  selectedSlots,
  onSuccess,
  onCancel,
}: CreateWorkLogFormProps) {
  const plants = usePlants();
  const [plantOpen, setPlantOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validActivities = getValidActivities(selectedSlots);
  const activityIntersection = getActivityIntersection(selectedSlots);
  const defaultActivity =
    activityIntersection.length > 0 ? activityIntersection[0] : validActivities[0];

  const sharedPlant =
    selectedSlots.length > 0 &&
    selectedSlots.every(
      (s) =>
        s.plantNumber === selectedSlots[0].plantNumber &&
        s.plantName === selectedSlots[0].plantName
    )
      ? {
          number: selectedSlots[0].plantNumber ?? "",
          name: selectedSlots[0].plantName ?? "",
        }
      : null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantNumber: sharedPlant?.number ?? "",
      plantName: sharedPlant?.name ?? "",
      date: new Date(),
      activity: defaultActivity ?? "Plant",
      notes: "",
    },
  });

  useEffect(() => {
    const current = form.getValues("activity") as Activity;
    if (validActivities.length > 0 && !validActivities.includes(current)) {
      form.setValue("activity", validActivities[0]);
    }
  }, [selectedSlots, validActivities, form]);

  const plantQuery = form.watch("plantNumber");
  const filteredPlants = plantQuery
    ? plants.filter(
        (p) =>
          plantNumberMatchesPrefix(plantQuery, p.number) ||
          (p.name?.toLowerCase().includes(plantQuery.toLowerCase().trim()) ?? false)
      )
    : plants;

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setIsSubmitting(true);
      try {
        const conflicts: { slot: Slot; reason: string }[] = [];
        const validSlots: Slot[] = [];

        for (const slot of selectedSlots) {
          const reason = getSlotConflict(
            slot,
            values.activity as Activity,
            values.plantNumber,
            values.plantName
          );
          if (reason) {
            conflicts.push({ slot, reason });
          } else {
            validSlots.push(slot);
          }
        }

        const uniqueSlotIds = Array.from(
          new Map(validSlots.map((s) => [s.slotId, s])).values()
        );

        const results = await Promise.all(
          uniqueSlotIds.map((slot) =>
            addWorkLog({
              plantNumber: values.plantNumber,
              plantName: values.plantName,
              date: values.date,
              spaceType: slot.spaceType,
              slotId: slot.slotId,
              activity: values.activity as Activity,
              notes: values.notes,
            })
          )
        );

        const failed = results.filter((r) => !r.ok);
        const created = uniqueSlotIds.length - failed.length;

        if (created > 0) {
          toast.success(
            `Work logs created for ${created} slot(s)${
              conflicts.length > 0
                ? `. ${conflicts.length} slot(s) skipped due to conflicts.`
                : ""
            }`
          );
          onSuccess();
        }

        if (failed.length > 0) {
          const errMsg = failed[0].error ?? "Failed to save";
          toast.error(errMsg);
          return;
        }

        if (created === 0 && conflicts.length > 0) {
          toast.error("No work logs created. Resolve conflicts and try again.");
          return;
        }

        if (created === 0 && conflicts.length === 0) {
          toast.error("No slots to update.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedSlots, onSuccess]
  );

  const activityVal = form.watch("activity") as Activity;
  const plantNum = form.watch("plantNumber");
  const plantNam = form.watch("plantName");
  const liveConflicts = selectedSlots
    .map((slot) => {
      const reason = getSlotConflict(slot, activityVal, plantNum, plantNam);
      return reason ? { slot, reason } : null;
    })
    .filter((c): c is { slot: Slot; reason: string } => c !== null);

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="plantNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plant (Number or Name)</FormLabel>
                <Popover open={plantOpen} onOpenChange={setPlantOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value || "Select plant..."}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput
                        placeholder="e.g. 92 (matches 9200–9299.9) or name"
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                      <CommandList>
                        <CommandEmpty>No plant found</CommandEmpty>
                        <CommandGroup>
                          {filteredPlants.slice(0, 50).map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.number}
                              onSelect={() => {
                                form.setValue("plantNumber", p.number);
                                form.setValue("plantName", p.name);
                                setPlantOpen(false);
                              }}
                            >
                              {p.number} — {p.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plantName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plant Name (auto-filled)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Rosemary" readOnly />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(d) => {
                        field.onChange(d ?? new Date());
                        setDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="activity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Activity</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={validActivities.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {validActivities.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                    {validActivities.length === 0 && (
                      <SelectItem value="__none__" disabled>
                        No valid activities for selected slots
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {form.watch("activity") === "Pick"
                    ? "Yield (optional)"
                    : "Notes (optional)"}
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={2}
                    placeholder={
                      form.watch("activity") === "Pick"
                        ? "e.g. 2 lb, 3 bunches"
                        : "Free-form notes"
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {liveConflicts.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                The following slots cannot receive this work log:
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {liveConflicts.map(({ slot, reason }) => (
                  <li key={slot.id}>
                    <span className="font-medium">{slot.slotId}</span>: {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || validActivities.length === 0}
              className="flex-1"
            >
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
