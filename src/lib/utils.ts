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
