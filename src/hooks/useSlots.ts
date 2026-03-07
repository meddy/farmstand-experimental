import { useState, useEffect } from "react";
import { subscribeSlots } from "@/lib/firestore";
import type { Slot } from "@/lib/types";

export function useSlots(): Slot[] {
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    return subscribeSlots(setSlots);
  }, []);

  return slots;
}
