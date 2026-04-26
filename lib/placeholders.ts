/**
 * Visual asset map — all work stills live under `public/images/work/site-pull/`.
 *
 * **Color** comes from `work-color-groups` ( `npm run color:group` ) + `work-curation.json` (`colorOverrides`, etc.).
 * **Sections** (Editorial, Red Carpet, …) are virtual: `lib/build-work-sections.ts` + `sectionOverrides` /
 * `work-site-section-metadata.json` + quarter split on `SITE_PULL_FILENAMES` order. No on-disk folders.
 *
 * `workColorGroups` is the merge of all sections, deduped by `src` (for World and flat layouts).
 *
 * ## Instagram
 * Do not scrape Instagram. Export or download images only with permission; place them in
 *   /public/images/instagram/
 * or add them later through a CMS. Nothing here pulls from Instagram automatically.
 */
import type { WorkItem } from "./work-types";
import type { WorkColorKey } from "./work-types";
import { WORK_COLOR_ORDER } from "./work-types";
import { applyWorkCuration } from "./apply-work-curation";
import {
  buildWorkSections,
  mergeWorkSectionsToFlatColorGroups,
  type WorkSections,
} from "./build-work-sections";
import { workCuration } from "./work-curation";
import { workColorGroups as workColorGroupsGenerated } from "./work-color-groups";
import {
  PERSON_FILTER_APPLIED,
  PERSON_IMAGE_FILENAMES,
} from "./work-person-filtered";
import { SITE_PULL_FILENAMES } from "./site-pull-files";
import workSiteSectionMetadata from "./work-site-section-metadata.json";
import { WORLD_STILLS_MAX, WORLD_STILLS_MIN } from "./world-stills-bounds";

export type { WorkItem } from "./work-types";
export { WORK_COLOR_ORDER, WORK_SECTION_ORDER } from "./work-types";
export type { WorkColorKey, WorkMediaKind, WorkSectionKey } from "./work-types";

const ph = "/images/placeholder.svg";

function isWorkColorGroupsEmpty(
  g: Record<WorkColorKey, WorkItem[]>
): boolean {
  return WORK_COLOR_ORDER.every(({ key }) => (g[key]?.length ?? 0) === 0);
}

function workItemsFromFilenames(
  basePath: string,
  filenames: readonly string[]
): Record<WorkColorKey, WorkItem[]> {
  const out: Record<WorkColorKey, WorkItem[]> = {
    black: [],
    white: [],
    neutral: [],
    warm: [],
    cool: [],
    vivid: [],
  };
  const order = WORK_COLOR_ORDER.map((x) => x.key);
  for (let i = 0; i < filenames.length; i++) {
    const k = order[i % order.length];
    out[k].push({
      kind: "image",
      src: `${basePath}/${filenames[i]}`,
    });
  }
  return out;
}

/**
 * Auto groups from `color:group`, then curation; or fallback strips, then curation the same way.
 */
const curatedWorkColorGroups: Record<WorkColorKey, WorkItem[]> = (() => {
  const base: Record<WorkColorKey, WorkItem[]> = (() => {
    if (!isWorkColorGroupsEmpty(workColorGroupsGenerated)) {
      return workColorGroupsGenerated;
    }
    if (PERSON_FILTER_APPLIED) {
      return workItemsFromFilenames(
        "/images/work/site-pull",
        PERSON_IMAGE_FILENAMES
      );
    }
    return workItemsFromFilenames(
      "/images/work/site-pull",
      SITE_PULL_FILENAMES
    );
  })();
  return applyWorkCuration(base, workCuration);
})();

/** Virtual sections (same color groups each). Built from curated groups + section rules. */
export const workSections: WorkSections = buildWorkSections(
  curatedWorkColorGroups,
  workCuration,
  SITE_PULL_FILENAMES,
  workSiteSectionMetadata as Record<string, string>
);

/** Flat merge of all sections, deduped by `src`, for World + legacy flat usage. */
export const workColorGroups: Record<WorkColorKey, WorkItem[]> =
  mergeWorkSectionsToFlatColorGroups(workSections);

/** @deprecated Use workColorGroups — kept as alias for existing imports. */
export const workAssets: Record<WorkColorKey, WorkItem[]> = workColorGroups;

export type { WorkSections };

/**
 * Global hero and world stills. Point at real files under /public/images/ as they exist.
 * Hero and world use the shared placeholder until you add photography paths.
 */
export const images = {
  hero: ph,
  world: [ph, ph, ph, ph, ph, ph] as string[],
} as const;

export const copy = {
  worldIntro: "Stills. One slow pass — not a catalog.",
} as const;

export { WORLD_STILLS_MAX, WORLD_STILLS_MIN } from "./world-stills-bounds";

/**
 * 6–10 stills for /the-world, using the same color groups as the Work page: generated
 * `work-color-groups` (paths under /images/work/site-pull/) with `applyWorkCuration`, via
 * `workColorGroups`. Takes the first and second un-seen image per group (Black, White, Neutral,
 * Warm, Cool, Vivid), deduplicates, then backfills in stable order to reach up to
 * `WORLD_STILLS_MAX`. If there are no images in the groups, returns `WORLD_STILLS_MIN`×
 * placeholder.svg.
 */
export function getWorldStillsFromColorGroups(): string[] {
  const groups = workColorGroups;

  const imageSrcs = (key: WorkColorKey): string[] =>
    groups[key]
      .filter((i) => i.kind === "image")
      .map((i) => i.src);

  const tryAppend = (src: string, seen: Set<string>, out: string[]) => {
    if (seen.has(src) || out.length >= WORLD_STILLS_MAX) return;
    seen.add(src);
    out.push(src);
  };

  const seen = new Set<string>();
  const out: string[] = [];

  for (let round = 0; round < 2; round++) {
    for (const { key } of WORK_COLOR_ORDER) {
      if (out.length >= WORLD_STILLS_MAX) break;
      for (const src of imageSrcs(key)) {
        if (seen.has(src)) continue;
        tryAppend(src, seen, out);
        break;
      }
    }
  }

  for (const { key } of WORK_COLOR_ORDER) {
    if (out.length >= WORLD_STILLS_MAX) break;
    for (const item of groups[key]) {
      if (out.length >= WORLD_STILLS_MAX) break;
      if (item.kind === "image") tryAppend(item.src, seen, out);
    }
  }

  if (out.length === 0) {
    return Array(WORLD_STILLS_MIN).fill(ph) as string[];
  }
  return out.slice(0, WORLD_STILLS_MAX);
}

export const getWorldStillsFromWork = getWorldStillsFromColorGroups;

export { getHomeFrameSlides } from "./home-frame-slides";
