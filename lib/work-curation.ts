/**
 * Work archive curation — edit `work-curation.json` (re-exported here with stable names).
 * Applied in `apply-work-curation.ts` on top of `work-color-groups` so you can tune without
 * re-running `npm run color:group` for every change.
 */
import curationJson from "./work-curation.json";

export type WorkCurationConfig = {
  colorOverrides: Partial<Record<string, string>>;
  /** Basename (e.g. site-001.jpg) → section key. Highest priority for section assignment. */
  sectionOverrides?: Partial<Record<string, string>>;
  excludeFilenames: string[];
  featuredOrder: string[];
};

export const workCuration: WorkCurationConfig = curationJson;

/** Basename → target group. Same as `workCuration.colorOverrides`. */
export const COLOR_OVERRIDES: Partial<Record<string, string>> = workCuration.colorOverrides;
/** Basename → work section (editorial, redCarpet, …). See `normalizeWorkSectionKey` in `build-work-sections.ts`. */
export const SECTION_OVERRIDES: Readonly<Partial<Record<string, string>>> =
  workCuration.sectionOverrides ?? {};
/** Hidden from Work. */
export const EXCLUDE_FILENAMES: readonly string[] = workCuration.excludeFilenames;
/** Appear first within their group, in this order. */
export const FEATURED_ORDER: readonly string[] = workCuration.featuredOrder;
