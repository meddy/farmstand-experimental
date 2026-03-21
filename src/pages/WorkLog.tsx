import { format } from "date-fns";
import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { useSlots } from "@/hooks/useSlots";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/types";
import { isValidTransition } from "@/lib/transitions";
import { toast } from "sonner";

const ACTIVITIES: Activity[] = [
  "Plant",
  "Transplant",
  "Fertilize",
  "Harvest",
  "Prep for Spring",
  "Install",
];

const schema = z.object({
  plantNumber: z.string().min(1, "Plant number or name required"),
  plantName: z.string().min(1, "Plant name required"),
  date: z.date(),
  spaceType: z.enum(["Bucket", "Tray", "Trough", "Bin"]),
  slotId: z.string().min(1, "Select a slot"),
  activity: z.enum(ACTIVITIES as unknown as [string, ...string[]]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let j = 0;
  for (let i = 0; i < t.length && j < q.length; i++) {
    if (t[i] === q[j]) j++;
  }
  return j === q.length;
}

export function WorkLog() {
  const plants = usePlants();
  const slots = useSlots();
  const [plantOpen, setPlantOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantNumber: "",
      plantName: "",
      date: new Date(),
      spaceType: "Tray",
      slotId: "",
      activity: "Plant",
      notes: "",
    },
  });

  const spaceType = form.watch("spaceType");
  const slotId = form.watch("slotId");
  const selectedSlot = slots.find((s) => s.slotId === slotId);
  const validActivities = ACTIVITIES.filter((a) =>
    isValidTransition(selectedSlot?.state ?? null, a)
  );

  const plantQuery = form.watch("plantNumber");
  useEffect(() => {
    const current = form.getValues("activity");
    if (validActivities.length > 0 && !validActivities.includes(current as Activity)) {
      form.setValue("activity", validActivities[0]);
    }
  }, [slotId, validActivities, form]);

  const filteredPlants = plantQuery
    ? plants.filter(
        (p) =>
          p.number.toLowerCase().includes(plantQuery.toLowerCase()) ||
          fuzzyMatch(plantQuery, p.name)
      )
    : plants;

  const filteredSlots = slots.filter((s) => s.spaceType === spaceType);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      const result = await addWorkLog({
        ...values,
        activity: values.activity as Activity,
      });
      if (result.ok) {
        toast.success("Work log saved");
        form.reset({
          plantNumber: "",
          plantName: "",
          date: new Date(),
          spaceType: values.spaceType,
          slotId: "",
          activity: "Plant",
          notes: "",
        });
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    },
    [form]
  );

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Work Log</h2>
        <p className="text-sm text-muted-foreground">
          Log work by plant, date, location, and activity
        </p>
      </CardHeader>
      <CardContent>
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
                          placeholder="Search by number or name..."
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
              name="spaceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Space Type</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("slotId", "");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Bucket">Bucket</SelectItem>
                      <SelectItem value="Tray">Tray</SelectItem>
                      <SelectItem value="Trough">Trough</SelectItem>
                      <SelectItem value="Bin">Seed Bin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Slot)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select slot..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredSlots
                        .filter((s) => s.slotId)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.slotId}>
                            {s.slotId}
                            {s.state != null ? ` (${s.state})` : ""}
                          </SelectItem>
                        ))}
                      {filteredSlots.length === 0 && (
                        <SelectItem value="__none__" disabled>
                          No slots for this space type
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
                          Select a slot first
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
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="Free-form notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Save
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
