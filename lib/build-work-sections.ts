import { fileBaseFromSrc } from "./apply-work-curation";
import type { WorkCurationConfig } from "./work-curation";
import type { WorkItem } from "./work-types";
import {
  WORK_COLOR_ORDER,
  WORK_SECTION_ORDER,
  type WorkColorKey,
  type WorkSectionKey,
} from "./work-types";

const SECTION_KEYS: WorkSectionKey[] = WORK_SECTION_ORDER.map((s) => s.key);

function emptyColorGroups(): Record<WorkColorKey, WorkItem[]> {
  return {
    black: [],
    white: [],
    neutral: [],
    warm: [],
    cool: [],
    vivid: [],
  };
}

/**
 * Map human / legacy labels to `WorkSectionKey`. Unknown → null.
 */
export function normalizeWorkSectionKey(raw: string): WorkSectionKey | null {
  const t = String(raw).trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const squish = lower.replace(/[\s_-]+/g, "");

  if (t === "editorial" || lower === "editorial" || squish === "editorial")
    return "editorial";
  if (
    lower === "red carpet" ||
    lower === "red-carpet" ||
    lower === "redcarpet" ||
    squish === "redcarpet" ||
    t === "redCarpet"
  ) {
    return "redCarpet";
  }
  if (
    lower === "advertising" ||
    lower === "ads" ||
    lower === "ad" ||
    lower === "commercial" ||
    squish === "advertising" ||
    squish === "ads" ||
    squish === "commercial"
  ) {
    return "advertising";
  }
  if (
    lower === "costume" ||
    lower === "costume design" ||
    lower === "performance" ||
    squish === "costumedesign" ||
    t === "costumeDesign"
  ) {
    return "costumeDesign";
  }

  for (const k of SECTION_KEYS) {
    if (t === k) return k;
  }
  return null;
}

function sectionFromQuartile(
  basename: string,
  sitePullOrder: readonly string[]
): WorkSectionKey {
  const n = sitePullOrder.length;
  if (n === 0) return "editorial";
  const i = sitePullOrder.indexOf(basename);
  const rank = i >= 0 ? i : n;
  const t = rank / n;
  if (t < 0.25) return "editorial";
  if (t < 0.5) return "redCarpet";
  if (t < 0.75) return "advertising";
  return "costumeDesign";
}

function assignSection(
  basename: string,
  curation: WorkCurationConfig,
  sitePullOrder: readonly string[],
  fileMetadata: Readonly<Record<string, string>>
): WorkSectionKey {
  const so = curation.sectionOverrides;
  if (so) {
    const o = so[basename];
    if (o != null) {
      const k = normalizeWorkSectionKey(String(o));
      if (k) return k;
    }
  }
  const m = fileMetadata[basename];
  if (m != null) {
    const k = normalizeWorkSectionKey(String(m));
    if (k) return k;
  }
  return sectionFromQuartile(basename, sitePullOrder);
}

export type WorkSections = Record<WorkSectionKey, Record<WorkColorKey, WorkItem[]>>;

/**
 * Splits flat curated color groups into virtual sections. Order within each
 * (section × color) follows `WORK_COLOR_ORDER` iteration over `curated` lists.
 */
export function buildWorkSections(
  curated: Record<WorkColorKey, WorkItem[]>,
  curation: WorkCurationConfig,
  sitePullOrder: readonly string[],
  fileMetadata: Readonly<Record<string, string>> = {}
): WorkSections {
  const out: WorkSections = {
    editorial: emptyColorGroups(),
    redCarpet: emptyColorGroups(),
    advertising: emptyColorGroups(),
    costumeDesign: emptyColorGroups(),
  };

  for (const { key: colorKey } of WORK_COLOR_ORDER) {
    for (const item of curated[colorKey] || []) {
      if (item.kind !== "image" && item.kind !== "video") continue;
      const base = fileBaseFromSrc(item.src);
      const section = assignSection(base, curation, sitePullOrder, fileMetadata);
      out[section][colorKey].push(item);
    }
  }

  return out;
}

/**
 * Merged color groups for World / any flat strip: section order editorial → red carpet →
 * advertising → costume design; de-duplicated by `src` (first win).
 */
export function mergeWorkSectionsToFlatColorGroups(
  sections: WorkSections
): Record<WorkColorKey, WorkItem[]> {
  const out = emptyColorGroups();
  for (const { key: colorKey } of WORK_COLOR_ORDER) {
    const seen = new Set<string>();
    for (const { key: sectionKey } of WORK_SECTION_ORDER) {
      for (const item of sections[sectionKey][colorKey]) {
        if (seen.has(item.src)) continue;
        seen.add(item.src);
        out[colorKey].push(item);
      }
    }
  }
  return out;
}
