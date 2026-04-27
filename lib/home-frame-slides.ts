import { HOMEPAGE_FRAME_FILENAMES, SITE_PULL_FILENAMES } from "./site-pull-files";
import { workCuration } from "./work-curation";

const SITE_PULL = "/images/work/site-pull";
const PLACEHOLDER = "/images/placeholder.svg";
const MAX_SLIDES = 12;

const sitePullSet = new Set<string>(SITE_PULL_FILENAMES);
const curationExcludes = new Set(
  workCuration.excludeFilenames.map((f) => f.trim()).filter(Boolean)
);

/**
 * Return the next filename from the archive that is not in `used`, in `SITE_PULL` order.
 * Skips curation `excludeFilenames` (e.g. stills reserved for a single page).
 */
function takeNextUnused(used: Set<string>): string | undefined {
  for (const f of SITE_PULL_FILENAMES) {
    if (curationExcludes.has(f)) continue;
    if (!used.has(f)) return f;
  }
  return undefined;
}

/**
 * Slides for the homepage small frame — all valid entries in `HOMEPAGE_FRAME_FILENAMES`, invalid or
 * duplicate names replaced from `SITE_PULL_FILENAMES`, then (if still short) filled to at least 8
 * when the archive has enough. Capped at `MAX_SLIDES`. If nothing can be resolved, returns the
 * global placeholder.
 */
export function getHomeFrameSlides(): { kind: "image"; src: string }[] {
  if (HOMEPAGE_FRAME_FILENAMES.length === 0) {
    return [{ kind: "image", src: PLACEHOLDER }];
  }

  const used = new Set<string>();
  const out: string[] = [];

  for (const name of HOMEPAGE_FRAME_FILENAMES) {
    if (out.length >= MAX_SLIDES) break;
    if (curationExcludes.has(name) || !sitePullSet.has(name) || used.has(name)) {
      const sub = takeNextUnused(used);
      if (sub) {
        used.add(sub);
        out.push(sub);
      }
    } else {
      used.add(name);
      out.push(name);
    }
  }

  while (out.length < 8) {
    const sub = takeNextUnused(used);
    if (!sub) break;
    out.push(sub);
  }

  if (out.length === 0) {
    return [{ kind: "image", src: PLACEHOLDER }];
  }

  return out.slice(0, MAX_SLIDES).map((file) => ({
    kind: "image" as const,
    src: `${SITE_PULL}/${file}`,
  }));
}
