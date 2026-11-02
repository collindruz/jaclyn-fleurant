/**
 * Visual asset map — Work stills and local videos live in categorized folders
 * under `public/images/work/{editorial,costume-design,advertising,music-videos,events}/`.
 * Catalog: `npm run work:catalog` → `lib/work-catalog.ts`.
 * Projects: `lib/work-projects.json` (preserved by the catalog generator).
 */
import type { WorkItem, WorkProjectGroup } from "./work-types";
import type { WorkColorKey, WorkSectionKey } from "./work-types";
import { WORK_COLOR_ORDER, WORK_SECTION_ORDER } from "./work-types";
import { WORK_CATALOG, WORK_PROJECTS } from "./work-catalog";
import { WORLD_STILLS_MIN } from "./world-stills-bounds";

export type { WorkItem } from "./work-types";
export { WORK_COLOR_ORDER, WORK_SECTION_ORDER } from "./work-types";
export type { WorkColorKey, WorkMediaKind, WorkSectionKey } from "./work-types";

const ph = "/images/placeholder.svg";

export type WorkProjectSections = Record<WorkSectionKey, WorkProjectGroup[]>;

function emptyProjectSections(): WorkProjectSections {
  return {
    editorial: [],
    costumeDesign: [],
    advertising: [],
    musicVideos: [],
    events: [],
  };
}

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

function buildWorkProjectSectionsFromCatalog(): WorkProjectSections {
  const bySrc = new Map<string, WorkItem>();
  for (const item of WORK_CATALOG) {
    if (!bySrc.has(item.src)) bySrc.set(item.src, item);
  }
  const out = emptyProjectSections();
  const used = new Set<string>();
  for (const project of WORK_PROJECTS) {
    const section = project.sectionKey;
    if (!out[section]) continue;
    const items: WorkItem[] = [];
    for (const src of project.assets) {
      const item = bySrc.get(src);
      if (!item || used.has(item.src)) continue;
      used.add(item.src);
      items.push(item);
    }
    if (items.length === 0) continue;
    out[section].push({
      id: project.id,
      title: project.title,
      sectionKey: section,
      provisional: project.provisional,
      items,
    });
  }
  return out;
}

export const workProjectSections: WorkProjectSections =
  buildWorkProjectSectionsFromCatalog();

/** @deprecated Color groups are not used for Work carousels. Kept for World stills. */
export type WorkSections = Record<WorkSectionKey, Record<WorkColorKey, WorkItem[]>>;

function colorGroupsFromCatalog(): Record<WorkColorKey, WorkItem[]> {
  const out = emptyColorGroups();
  const seen = new Set<string>();
  for (const item of WORK_CATALOG) {
    if (seen.has(item.src)) continue;
    seen.add(item.src);
    const color = (item.colorKey as WorkColorKey | undefined) ?? "neutral";
    if (!out[color]) continue;
    out[color].push(item);
  }
  return out;
}

export const workColorGroups: Record<WorkColorKey, WorkItem[]> =
  colorGroupsFromCatalog();

/** Flat color buckets per section — unused by Work carousels; World/debug fallbacks. */
export const workSections: WorkSections = (() => {
  const out: WorkSections = {
    editorial: emptyColorGroups(),
    costumeDesign: emptyColorGroups(),
    advertising: emptyColorGroups(),
    musicVideos: emptyColorGroups(),
    events: emptyColorGroups(),
  };
  for (const { key: sectionKey } of WORK_SECTION_ORDER) {
    for (const group of workProjectSections[sectionKey]) {
      for (const item of group.items) {
        const color = (item.colorKey as WorkColorKey | undefined) ?? "neutral";
        if (out[sectionKey][color]) out[sectionKey][color].push(item);
      }
    }
  }
  return out;
})();

export const images = {
  hero: ph,
  world: [ph, ph, ph, ph, ph, ph] as string[],
} as const;

export { WORLD_STILLS_MIN } from "./world-stills-bounds";

const SKIP_WORLD_SRC = /\/(manual-review|site-pull|site-pull-cropped|site-pull-duplicates|unsorted|youtube-posters|video-posters)\//;

export type WorldStill = {
  src: string;
  width: number;
  height: number;
};

/**
 * Every approved local Work photo, once, in catalog/section order.
 * Videos, embeds, posters, legacy folders, and reserved Info stills are excluded.
 */
export function getWorldStillsFromCatalog(): WorldStill[] {
  const seen = new Set<string>();
  const out: WorldStill[] = [];
  for (const item of WORK_CATALOG) {
    if (item.kind !== "image") continue;
    const src = item.src;
    if (!src.startsWith("/images/work/")) continue;
    if (src.startsWith("http")) continue;
    if (SKIP_WORLD_SRC.test(src)) continue;
    if (src.includes("site-040.jpg")) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    out.push({
      src,
      width: item.width && item.width > 0 ? item.width : 4,
      height: item.height && item.height > 0 ? item.height : 5,
    });
  }
  return out;
}

/** @deprecated Use getWorldStillsFromCatalog. */
export function getWorldStillsFromColorGroups(): WorldStill[] {
  const stills = getWorldStillsFromCatalog();
  if (stills.length === 0) {
    return Array.from({ length: WORLD_STILLS_MIN }, () => ({
      src: ph,
      width: 4,
      height: 5,
    }));
  }
  return stills;
}

export const getWorldStillsFromWork = getWorldStillsFromColorGroups;

export { getHomeFrameSlides } from "./home-frame-slides";
