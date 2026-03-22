import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { addPlant } from "@/lib/firestore";
import { toast } from "sonner";

const schema = z.object({
  number: z.string().min(1, "Plant number required").trim(),
  name: z.string().min(1, "Plant name required").trim(),
  type: z.string().optional(),
  scientificName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddPlant() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      number: "",
      name: "",
      type: "",
      scientificName: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setIsSubmitting(true);
      try {
        await addPlant({
          number: values.number,
          name: values.name,
          type: values.type?.trim() || undefined,
          scientificName: values.scientificName?.trim() || undefined,
        });
        toast.success("Plant created");
        form.reset({
          number: "",
          name: "",
          type: "",
          scientificName: "",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create plant";
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
        <h2 className="text-lg font-semibold">Add Plant</h2>
        <p className="text-sm text-muted-foreground">
          Create a new plant and save it to Firestore. Required fields: Plant number and
          name.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plant Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. 9382.1, x123" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plant Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Rosemary" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Plant type" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scientificName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scientific Name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Rosmarinus officinalis" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Saving…" : "Create Plant"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
