import { HOMEPAGE_FRAME_FILENAMES, SITE_PULL_FILENAMES } from "./site-pull-files";

const SITE_PULL = "/images/work/site-pull";
const PLACEHOLDER = "/images/placeholder.svg";
const MAX_SLIDES = 12;

const sitePullSet = new Set<string>(SITE_PULL_FILENAMES);

/**
 * Return the next filename from the archive that is not in `used`, in `SITE_PULL` order.
 */
function takeNextUnused(used: Set<string>): string | undefined {
  for (const f of SITE_PULL_FILENAMES) {
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
    if (sitePullSet.has(name) && !used.has(name)) {
      used.add(name);
      out.push(name);
    } else {
      const sub = takeNextUnused(used);
      if (sub) {
        used.add(sub);
        out.push(sub);
      }
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
