import { format } from "date-fns";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { addSlot } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import {
  SPACE_TYPES,
  SLOT_STATES,
  ACTIVITIES,
  type SpaceType,
  type Activity,
} from "@/lib/types";
import { toast } from "sonner";

const HAS_SUBSPACE: SpaceType[] = ["Trough", "Bin"];

const schema = z.object({
  slotId: z.string().min(1, "Slot ID required").trim(),
  spaceType: z.enum(SPACE_TYPES as unknown as [string, ...string[]]),
  subspace: z.string().optional(),
  state: z
    .union([
      z.enum(SLOT_STATES as unknown as [string, ...string[]]),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v)),
  lastActivity: z
    .union([z.enum(ACTIVITIES as unknown as [string, ...string[]]), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  plantNumber: z.string().optional(),
  plantName: z.string().optional(),
  notes: z.string().optional(),
  planChange: z.date().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

export function AddSlot() {
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      slotId: "",
      spaceType: "Bucket",
      subspace: "",
      state: null,
      lastActivity: undefined,
      plantNumber: "",
      plantName: "",
      notes: "",
      planChange: null,
    },
  });

  const spaceType = form.watch("spaceType");
  const showSubspace = HAS_SUBSPACE.includes(spaceType as SpaceType);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setIsSubmitting(true);
      try {
        await addSlot({
          slotId: values.slotId,
          spaceType: values.spaceType,
          subspace: values.subspace?.trim() || undefined,
          state: values.state,
          lastActivity: values.lastActivity as Activity | undefined,
          plantNumber: values.plantNumber?.trim() || null,
          plantName: values.plantName?.trim() || null,
          notes: values.notes?.trim() || undefined,
          planChange: values.planChange ?? undefined,
        });
        toast.success("Slot created");
        form.reset({
          slotId: "",
          spaceType: "Bucket",
          subspace: "",
          state: null,
          lastActivity: undefined,
          plantNumber: "",
          plantName: "",
          notes: "",
          planChange: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create slot";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [form]
  );

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Add Slot</h2>
        <p className="text-sm text-muted-foreground">
          Create a new slot and save it to Firestore. Required fields: Slot ID, Space
          Type, and State.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="slotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slot ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. B01, Tray45, Trough 01-03" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="spaceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Space Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SPACE_TYPES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showSubspace && (
              <FormField
                control={form.control}
                name="subspace"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subspace (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Trough 01, Bin A"
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value ?? "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {SLOT_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
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
              name="lastActivity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Activity (optional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value ?? "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {ACTIVITIES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
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
              name="plantNumber"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PlantCombobox
                      optional
                      label={<FormLabel>Plant (optional)</FormLabel>}
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
                  <FormLabel>Plant Name (auto-filled)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Rosemary"
                      readOnly
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="Free-form notes"
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="planChange"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Plan Change Date (optional)</FormLabel>
                    {field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto py-0 text-xs"
                        onClick={() => field.onChange(null)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <Popover open={planChangeOpen} onOpenChange={setPlanChangeOpen}>
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
                        selected={field.value ?? undefined}
                        onSelect={(d) => {
                          field.onChange(d ?? null);
                          setPlanChangeOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Saving…" : "Create Slot"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
