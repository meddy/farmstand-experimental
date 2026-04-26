import type { SpaceType, Slot } from "@/lib/types";

const HAS_SUBSPACE: SpaceType[] = ["Trough", "Bin"];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normSubspace(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Distinct subspace values for slots of this space type (non-empty), sorted.
 */
export function getSubspaceOptionsForSpaceType(
  slots: Slot[],
  spaceType: SpaceType
): string[] {
  if (!HAS_SUBSPACE.includes(spaceType)) return [];
  const set = new Set<string>();
  for (const s of slots) {
    if (s.spaceType !== spaceType) continue;
    const ss = normSubspace(s.subspace);
    if (ss) set.add(ss);
  }
  return [...set].toSorted((a, b) => a.localeCompare(b));
}

function filterRelevantSlots(
  slots: Slot[],
  spaceType: SpaceType,
  subspace: string | null | undefined
): Slot[] {
  const ss = normSubspace(subspace);
  return slots.filter((s) => {
    if (s.spaceType !== spaceType) return false;
    if (HAS_SUBSPACE.includes(spaceType)) {
      if (!ss) return false;
      return normSubspace(s.subspace) === ss;
    }
    return true;
  });
}

/** Bucket: one letter prefix + digits, e.g. B02, B42 */
function suggestBucket(ids: string[]): string | null {
  const re = /^([A-Za-z]+)(\d+)$/;
  const parsed: Array<{ prefix: string; n: number; width: number }> = [];
  for (const id of ids) {
    const m = id.match(re);
    if (!m) return null;
    const numStr = m[2];
    parsed.push({ prefix: m[1], n: Number.parseInt(numStr, 10), width: numStr.length });
  }
  if (parsed.some((p) => Number.isNaN(p.n))) return null;
  const prefixes = new Set(parsed.map((p) => p.prefix));
  if (prefixes.size !== 1) return null;
  const prefix = parsed[0].prefix;
  const width = Math.max(...parsed.map((p) => p.width));
  const nums = new Set(parsed.map((p) => p.n));
  const minN = Math.min(...parsed.map((p) => p.n));
  const maxN = Math.max(...parsed.map((p) => p.n));
  for (let n = minN; n <= maxN; n++) {
    if (!nums.has(n)) {
      return `${prefix}${String(n).padStart(width, "0")}`;
    }
  }
  return `${prefix}${String(maxN + 1).padStart(width, "0")}`;
}

/** Bin: LETTER-NN, e.g. A-01, B-12 */
function suggestBin(ids: string[]): string | null {
  const re = /^([A-Za-z]+)-(\d+)$/;
  const parsed: Array<{ prefix: string; n: number; width: number }> = [];
  for (const id of ids) {
    const m = id.match(re);
    if (!m) return null;
    const numStr = m[2];
    parsed.push({ prefix: m[1], n: Number.parseInt(numStr, 10), width: numStr.length });
  }
  if (parsed.some((p) => Number.isNaN(p.n))) return null;
  const prefixes = new Set(parsed.map((p) => p.prefix));
  if (prefixes.size !== 1) return null;
  const prefix = parsed[0].prefix;
  const width = Math.max(...parsed.map((p) => p.width));
  const nums = new Set(parsed.map((p) => p.n));
  const minN = Math.min(...parsed.map((p) => p.n));
  const maxN = Math.max(...parsed.map((p) => p.n));
  for (let n = minN; n <= maxN; n++) {
    if (!nums.has(n)) {
      return `${prefix}-${String(n).padStart(width, "0")}`;
    }
  }
  return `${prefix}-${String(maxN + 1).padStart(width, "0")}`;
}

/** Tray: PREFIX + digits + '-' + suffix, e.g. T01-L, T01-R */
function suggestTray(ids: string[]): string | null {
  const re = /^([A-Za-z]+)(\d+)-([A-Za-z0-9]+)$/;
  const parsed: Array<{ prefix: string; n: number; width: number; suffix: string }> =
    [];
  for (const id of ids) {
    const m = id.match(re);
    if (!m) return null;
    const numStr = m[2];
    parsed.push({
      prefix: m[1],
      n: Number.parseInt(numStr, 10),
      width: numStr.length,
      suffix: m[3],
    });
  }
  if (parsed.some((p) => Number.isNaN(p.n))) return null;
  const prefixes = new Set(parsed.map((p) => p.prefix));
  if (prefixes.size !== 1) return null;
  const prefix = parsed[0].prefix;
  const digitWidth = Math.max(...parsed.map((p) => p.width));
  const suffixOrder = [...new Set(parsed.map((p) => p.suffix))].toSorted((a, b) =>
    a.localeCompare(b)
  );
  const byNum = new Map<number, Set<string>>();
  for (const p of parsed) {
    const set = byNum.get(p.n) ?? new Set<string>();
    set.add(p.suffix);
    byNum.set(p.n, set);
  }
  const minN = Math.min(...byNum.keys());
  const maxN = Math.max(...byNum.keys());
  for (let n = minN; n <= maxN; n++) {
    for (const suf of suffixOrder) {
      if (!byNum.get(n)?.has(suf)) {
        return `${prefix}${String(n).padStart(digitWidth, "0")}-${suf}`;
      }
    }
  }
  const firstSuf = suffixOrder[0];
  if (firstSuf === undefined) return null;
  return `${prefix}${String(maxN + 1).padStart(digitWidth, "0")}-${firstSuf}`;
}

/** Trough: PREFIX-NUM where PREFIX matches subspace or is shared across ids. */
function suggestTrough(ids: string[], subspace: string): string | null {
  const ss = normSubspace(subspace);
  if (!ss) return null;

  const exactRe = new RegExp(`^${escapeRegex(ss)}-(\\d+)$`);
  const exactParsed: Array<{ n: number; width: number }> = [];
  let allExact = true;
  for (const id of ids) {
    const m = id.match(exactRe);
    if (!m) {
      allExact = false;
      break;
    }
    const numStr = m[1];
    exactParsed.push({ n: Number.parseInt(numStr, 10), width: numStr.length });
  }
  if (allExact && exactParsed.length > 0) {
    if (exactParsed.some((p) => Number.isNaN(p.n))) return null;
    const width = Math.max(...exactParsed.map((p) => p.width));
    const nums = new Set(exactParsed.map((p) => p.n));
    const minN = Math.min(...exactParsed.map((p) => p.n));
    const maxN = Math.max(...exactParsed.map((p) => p.n));
    for (let n = minN; n <= maxN; n++) {
      if (!nums.has(n)) {
        return `${ss}-${String(n).padStart(width, "0")}`;
      }
    }
    return `${ss}-${String(maxN + 1).padStart(width, "0")}`;
  }

  const looseRe = /^(.+)-(\d+)$/;
  const looseParsed: Array<{ prefix: string; n: number; width: number }> = [];
  for (const id of ids) {
    const m = id.match(looseRe);
    if (!m) return null;
    const numStr = m[2];
    looseParsed.push({
      prefix: m[1],
      n: Number.parseInt(numStr, 10),
      width: numStr.length,
    });
  }
  if (looseParsed.some((p) => Number.isNaN(p.n))) return null;
  const prefixes = new Set(looseParsed.map((p) => p.prefix));
  if (prefixes.size !== 1) return null;
  const prefix = looseParsed[0].prefix;
  const width = Math.max(...looseParsed.map((p) => p.width));
  const nums = new Set(looseParsed.map((p) => p.n));
  const minN = Math.min(...looseParsed.map((p) => p.n));
  const maxN = Math.max(...looseParsed.map((p) => p.n));
  for (let n = minN; n <= maxN; n++) {
    if (!nums.has(n)) {
      return `${prefix}-${String(n).padStart(width, "0")}`;
    }
  }
  return `${prefix}-${String(maxN + 1).padStart(width, "0")}`;
}

/**
 * Suggests the next Slot ID string from existing slots of the same space type.
 * For Bin and Trough, `subspace` must match existing slots' subspace.
 */
export function suggestNextSlotId(
  slots: Slot[],
  spaceType: SpaceType,
  subspace: string | null | undefined
): string | null {
  const relevant = filterRelevantSlots(slots, spaceType, subspace);
  const ids = [...new Set(relevant.map((s) => s.slotId.trim()).filter(Boolean))];
  if (ids.length === 0) return null;

  switch (spaceType) {
    case "Bucket":
      return suggestBucket(ids);
    case "Tray":
      return suggestTray(ids);
    case "Bin":
      return suggestBin(ids);
    case "Trough":
      return suggestTrough(ids, normSubspace(subspace));
    default:
      return null;
  }
}
