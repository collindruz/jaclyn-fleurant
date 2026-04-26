import type { WorkItem } from "./work-types";
import type { WorkColorKey } from "./work-types";
import { WORK_COLOR_ORDER } from "./work-types";
import type { WorkCurationConfig } from "./work-curation";

const KEYS: WorkColorKey[] = [
  "black",
  "white",
  "neutral",
  "warm",
  "cool",
  "vivid",
];

function fileBaseFromSrc(src: string): string {
  const i = src.lastIndexOf("/");
  return i === -1 ? src : src.slice(i + 1);
}

/**
 * Map override labels to WorkColorKey (includes legacy color names from older maps).
 * @param raw
 * @returns null if not a valid key
 */
export function normalizeColorOverride(
  raw: string
): WorkColorKey | null {
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  const map: Record<string, WorkColorKey> = {
    black: "black",
    white: "white",
    neutral: "neutral",
    warm: "warm",
    cool: "cool",
    vivid: "vivid",
    red: "warm",
    orange: "warm",
    gold: "warm",
    yellow: "warm",
    pink: "warm",
    rose: "warm",
    blue: "cool",
    navy: "cool",
    green: "cool",
    mint: "cool",
    teal: "cool",
    cyan: "cool",
    purple: "cool",
    violet: "cool",
    metallic: "neutral",
    silver: "neutral",
    pattern: "vivid",
    "pattern / multi": "vivid",
    "pattern/multi": "vivid",
    multi: "vivid",
  };
  if (map[s]) return map[s];
  if (KEYS.includes(s as WorkColorKey)) return s as WorkColorKey;
  return null;
}

/**
 * 1) Drop excluded basenames. 2) Re-assign `colorOverrides` to another group. 3) Deduplicate by `src`
 * (one place per file). 4) Within each group, `featuredOrder` first (in list order), then the rest
 * in stable order.
 */
export function applyWorkCuration(
  input: Record<WorkColorKey, WorkItem[]>,
  c: WorkCurationConfig
): Record<WorkColorKey, WorkItem[]> {
  const exclude = new Set(
    c.excludeFilenames.map((f) => f.trim()).filter(Boolean)
  );
  const featured = c.featuredOrder
    .map((f) => f.trim())
    .filter(Boolean);

  type Entry = { item: WorkItem; fromKey: WorkColorKey };
  const flat: Entry[] = [];
  for (const { key: fromKey } of WORK_COLOR_ORDER) {
    for (const item of input[fromKey] || []) {
      if (item.kind !== "image") continue;
      flat.push({ item, fromKey });
    }
  }

  const bySrc = new Map<string, Entry>();
  for (const e of flat) {
    if (bySrc.has(e.item.src)) continue;
    bySrc.set(e.item.src, e);
  }

  const out: Record<WorkColorKey, WorkItem[]> = {
    black: [],
    white: [],
    neutral: [],
    warm: [],
    cool: [],
    vivid: [],
  };

  for (const { item, fromKey } of bySrc.values()) {
    const base = fileBaseFromSrc(item.src);
    if (exclude.has(base)) continue;

    let key: WorkColorKey = fromKey;
    const o = c.colorOverrides[base];
    if (o != null) {
      const k = normalizeColorOverride(String(o));
      if (k) key = k;
    }
    out[key].push(item);
  }

  for (const k of KEYS) {
    out[k] = sortGroupByFeatured(out[k]!, featured);
  }

  return out;
}

function sortGroupByFeatured(
  items: WorkItem[],
  featured: readonly string[]
): WorkItem[] {
  if (items.length === 0 || featured.length === 0) return items;
  return [...items]
    .map((it, i) => {
      const b = fileBaseFromSrc(it.src);
      const fp = featured.indexOf(b);
      return { it, i, b, fp };
    })
    .sort((a, b) => {
      const aFeat = a.fp !== -1;
      const bFeat = b.fp !== -1;
      if (aFeat && bFeat) return a.fp - b.fp;
      if (aFeat && !bFeat) return -1;
      if (!aFeat && bFeat) return 1;
      return a.i - b.i;
    })
    .map((x) => x.it);
}
