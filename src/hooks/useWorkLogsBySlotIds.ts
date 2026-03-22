import { useState, useEffect } from "react";
import { subscribeWorkLogsBySlotIds } from "@/lib/firestore";
import type { WorkLog } from "@/lib/types";

export function useWorkLogsBySlotIds(slotIds: string[]): WorkLog[] {
  const [logs, setLogs] = useState<WorkLog[]>([]);

  useEffect(() => {
    if (slotIds.length === 0) {
      setLogs([]);
      return;
    }
    return subscribeWorkLogsBySlotIds(slotIds, setLogs);
  }, [slotIds.join(",")]);

  return logs;
}
