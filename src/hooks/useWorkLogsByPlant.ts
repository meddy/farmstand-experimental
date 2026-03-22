import { useState, useEffect } from "react";
import { subscribeWorkLogsByPlantNumber } from "@/lib/firestore";
import type { WorkLog } from "@/lib/types";

export function useWorkLogsByPlant(plantNumber: string): WorkLog[] {
  const [logs, setLogs] = useState<WorkLog[]>([]);

  useEffect(() => {
    if (!plantNumber) {
      setLogs([]);
      return;
    }
    return subscribeWorkLogsByPlantNumber(plantNumber, setLogs);
  }, [plantNumber]);

  return logs;
}
