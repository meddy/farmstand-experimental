import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlants } from "@/hooks/usePlants";
import { cn, plantNumberMatchesPrefix } from "@/lib/utils";

export interface PlantSelection {
  number: string;
  name: string;
}

export interface PlantComboboxProps {
  value: PlantSelection;
  onChange: (next: PlantSelection) => void;
  /** When true: shows Clear and optional placeholder text. */
  optional?: boolean;
  /** When set with `optional`, rendered in a row with the Clear control (e.g. FormLabel). */
  label?: ReactNode;
}

const LIST_CAP = 50;

export function PlantCombobox({
  value,
  onChange,
  optional = false,
  label,
}: PlantComboboxProps) {
  const plants = usePlants();
  const [open, setOpen] = useState(false);

  const filteredPlants = useMemo(() => {
    const q = value.number;
    if (!q) return plants;
    const qt = q.toLowerCase().trim();
    return plants.filter(
      (p) =>
        plantNumberMatchesPrefix(q, p.number) ||
        (p.name?.toLowerCase().includes(qt) ?? false)
    );
  }, [plants, value.number]);

  const visiblePlants = useMemo(
    () => filteredPlants.slice(0, LIST_CAP),
    [filteredPlants]
  );

  const placeholder = optional ? "Select plant (optional)..." : "Select plant...";
  const inputPlaceholder = optional
    ? "e.g. 92 or name"
    : "e.g. 92 (matches 9200–9299.9) or name";

  const hasSelection = Boolean(value.number?.trim() || value.name?.trim());

  return (
    <div className="space-y-2">
      {optional && label && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{label}</div>
          {hasSelection && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto shrink-0 py-0 text-xs"
              onClick={() => onChange({ number: "", name: "" })}
            >
              Clear
            </Button>
          )}
        </div>
      )}
      {optional && !label && hasSelection && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto py-0 text-xs"
            onClick={() => onChange({ number: "", name: "" })}
          >
            Clear
          </Button>
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              !value.number && "text-muted-foreground"
            )}
          >
            {value.number || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={inputPlaceholder}
              value={value.number}
              onValueChange={(v) => onChange({ number: v, name: value.name })}
            />
            <CommandList>
              <CommandEmpty>No plant found</CommandEmpty>
              <CommandGroup>
                {visiblePlants.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.number}
                    onSelect={() => {
                      onChange({ number: p.number, name: p.name });
                      setOpen(false);
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
    </div>
  );
}
