import { useEffect, useMemo, useState } from "react";
import { subscribeWorkLogsByPlantBaseNumbers } from "@/lib/firestore";
import type { WorkLog } from "@/lib/types";

export function useWorkLogsByPlantBaseNumbers(baseNumbers: string[]): WorkLog[] {
  const [logs, setLogs] = useState<WorkLog[]>([]);

  const normalized = useMemo(
    () =>
      Array.from(
        new Set(baseNumbers.map((value) => value.trim()).filter(Boolean))
      ).sort(),
    [baseNumbers.join(",")]
  );

  useEffect(() => {
    if (normalized.length === 0) {
      setLogs([]);
      return;
    }
    return subscribeWorkLogsByPlantBaseNumbers(normalized, setLogs);
  }, [normalized.join(",")]);

  return logs;
}
