import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { PlantCombobox } from "@/components/PlantCombobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SLOT_STATES, type Slot, type SlotState } from "@/lib/types";
import { slotEditCommand, type PlantEditMode } from "@/lib/slotEditCommand";

const STATE_NULL_VALUE = "__null__";

const schema = z
  .object({
    state: z.string().min(1, "State is required"),
    plantMode: z.enum(["leave", "set", "clear"] as const),
    plantNumber: z.string().optional(),
    plantName: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.plantMode === "set") {
      const number = values.plantNumber?.trim() ?? "";
      const name = values.plantName?.trim() ?? "";
      if (!number || !name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plantNumber"],
          message: "Plant Number and Plant Name are required",
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

interface EditSlotFormProps {
  selectedSlots: Slot[];
  initialState?: SlotState;
  initialPlantMode?: PlantEditMode;
  onSuccess: () => void;
  onCancel: () => void;
}

function toStateValue(state: SlotState | undefined): string {
  if (state === undefined) return "";
  return state === null ? STATE_NULL_VALUE : state;
}

function fromStateValue(value: string): SlotState {
  return value === STATE_NULL_VALUE ? null : (value as SlotState);
}

export function EditSlotForm({
  selectedSlots,
  initialState,
  initialPlantMode = "leave",
  onSuccess,
  onCancel,
}: EditSlotFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sharedPlant = useMemo(() => {
    if (selectedSlots.length === 0) return null;
    const first = selectedSlots[0];
    const same = selectedSlots.every(
      (slot) =>
        slot.plantNumber === first.plantNumber && slot.plantName === first.plantName
    );
    if (!same) return null;
    return {
      number: first.plantNumber ?? "",
      name: first.plantName ?? "",
    };
  }, [selectedSlots]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      state: toStateValue(initialState),
      plantMode: initialPlantMode,
      plantNumber: sharedPlant?.number ?? "",
      plantName: sharedPlant?.name ?? "",
    },
  });

  const plantMode = form.watch("plantMode");

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setIsSubmitting(true);
      try {
        const draft = {
          state: fromStateValue(values.state),
          plantMode: values.plantMode,
          plantNumber: values.plantNumber,
          plantName: values.plantName,
        };
        const result = await slotEditCommand.commit(selectedSlots, draft);
        const failed = result.results.filter((item) => !item.ok);
        if (failed.length > 0) {
          toast.error(failed[0].error ?? "Failed to update slot");
          return;
        }
        const count = result.appliedCount;
        toast.success(count === 1 ? "Slot updated" : `Updated ${count} slots`);
        onSuccess();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess, selectedSlots]
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={STATE_NULL_VALUE}>None</SelectItem>
                  {SLOT_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plantMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plant update</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="leave">Leave unchanged</SelectItem>
                  <SelectItem value="set">Set plant</SelectItem>
                  <SelectItem value="clear">Clear plant</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {plantMode === "set" && (
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plant Name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
