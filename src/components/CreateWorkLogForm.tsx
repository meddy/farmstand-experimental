import { format } from "date-fns";
import { useState, useCallback, useEffect, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlantCombobox } from "@/components/PlantCombobox";
import { usePlants } from "@/hooks/usePlants";
import { workLogCommand } from "@/lib/workLogCommand";
import { cn } from "@/lib/utils";
import { ACTIVITIES, type Activity } from "@/lib/types";
import type { Slot } from "@/lib/types";
import { toast } from "sonner";

const schema = z.object({
  plantNumber: z.string().optional(),
  plantName: z.string().optional(),
  date: z.date(),
  activity: z.enum(ACTIVITIES as unknown as [string, ...string[]]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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
  const [dateOpen, setDateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validActivities = workLogCommand.activitiesForSelection(selectedSlots);
  const defaultActivity =
    workLogCommand.defaultActivity(selectedSlots) ?? ("Plant" as Activity);

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

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setIsSubmitting(true);
      try {
        const selectedActivity = values.activity as Activity;
        const requiresPlant =
          selectedActivity === "Plant" || selectedActivity === "Transplant";
        const normalizedPlantNumber = requiresPlant
          ? values.plantNumber?.trim() || null
          : null;
        const normalizedPlantName = requiresPlant
          ? values.plantName?.trim() || null
          : null;
        const hasMatchingPlant =
          !requiresPlant ||
          plants.some(
            (p) => p.number === normalizedPlantNumber && p.name === normalizedPlantName
          );

        if (!hasMatchingPlant) {
          form.setError("plantNumber", {
            type: "validate",
            message: "Select an existing plant from the list.",
          });
          return;
        }

        const result = await workLogCommand.commit(selectedSlots, {
          activity: selectedActivity,
          plantNumber: normalizedPlantNumber,
          plantName: normalizedPlantName,
          date: values.date,
          notes: values.notes,
        });

        const failed = result.results.filter((r) => !r.ok);
        const created = result.appliedCount;

        if (created > 0) {
          toast.success(
            `Work logs created for ${created} slot(s)${
              result.skipped.length > 0
                ? `. ${result.skipped.length} slot(s) skipped due to conflicts.`
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

        if (created === 0 && result.skipped.length > 0) {
          toast.error("No work logs created. Resolve conflicts and try again.");
          return;
        }

        if (created === 0 && result.skipped.length === 0) {
          toast.error("No slots to update.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedSlots, onSuccess, plants, form]
  );

  const activityVal = form.watch("activity") as Activity;
  const plantNum = form.watch("plantNumber");
  const plantNam = form.watch("plantName");
  const dateVal = form.watch("date");
  const requiresPlantSelection =
    activityVal === "Plant" || activityVal === "Transplant";
  const hasValidRequiredPlantSelection = useMemo(() => {
    if (!requiresPlantSelection) return true;
    const number = (plantNum ?? "").trim();
    const name = (plantNam ?? "").trim();
    if (!number || !name) return false;
    return plants.some((p) => p.number === number && p.name === name);
  }, [requiresPlantSelection, plantNum, plantNam, plants]);
  const liveConflicts = useMemo(
    () =>
      workLogCommand.previewConflicts(selectedSlots, {
        activity: activityVal,
        plantNumber: requiresPlantSelection ? (plantNum ?? null) : null,
        plantName: requiresPlantSelection ? (plantNam ?? null) : null,
        date: dateVal,
      }),
    [selectedSlots, activityVal, requiresPlantSelection, plantNum, plantNam, dateVal]
  );

  useEffect(() => {
    if (!requiresPlantSelection) {
      form.clearErrors("plantNumber");
    }
  }, [requiresPlantSelection, form]);

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {requiresPlantSelection && (
            <>
              <FormField
                control={form.control}
                name="plantNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plant (Number or Name)</FormLabel>
                    <FormControl>
                      <PlantCombobox
                        value={{
                          number: field.value ?? "",
                          name: form.watch("plantName") ?? "",
                        }}
                        onChange={(next) => {
                          form.setValue("plantNumber", next.number);
                          form.setValue("plantName", next.name);
                        }}
                      />
                    </FormControl>
                    {!hasValidRequiredPlantSelection && (
                      <p className="text-sm text-destructive">
                        Select an existing plant from the list.
                      </p>
                    )}
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
            </>
          )}

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
