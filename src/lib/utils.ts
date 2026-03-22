import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Plant number matches query when it starts with the query (first digits). e.g. "92" matches 9200-9299.9, not 1092. */
export function plantNumberMatchesPrefix(query: string, plantNumber: string): boolean {
  const q = query.trim();
  if (!q || !plantNumber) return false;
  return plantNumber.startsWith(q);
}

export type WorkLogWithDate = {
  date?: { toDate?: () => Date };
};

/** Group work logs by year and quarter (newest first). Keys are "YYYY-QN" e.g. "2025-Q4". */
export function groupWorkLogsByYearQuarter<T extends WorkLogWithDate>(
  logs: T[]
): Map<string, T[]> {
  const sorted = [...logs].sort((a, b) => {
    const aDate = a.date?.toDate?.() ?? new Date(0);
    const bDate = b.date?.toDate?.() ?? new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

  const groups = new Map<string, T[]>();
  for (const log of sorted) {
    const d = log.date?.toDate?.();
    if (!d) continue;
    const year = d.getFullYear();
    const month = d.getMonth();
    const quarter = Math.ceil((month + 1) / 3);
    const key = `${year}-Q${quarter}`;
    const arr = groups.get(key) ?? [];
    arr.push(log);
    groups.set(key, arr);
  }
  return groups;
}
