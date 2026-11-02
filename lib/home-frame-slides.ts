import { WORK_CATALOG } from "./work-catalog";

const MAX_SLIDES = 8;
/** Curated Intro stills — current categorized paths only. */
const PREFERRED = [
  "site-001.jpg",
  "site-004.jpg",
  "site-044.png",
  "site-062.jpg",
  "site-122.webp",
  "site-003.webp",
  "IMG_1178.jpg",
  "site-166.jpg",
];

function basename(src: string): string {
  try {
    const pathOnly = src.split("?")[0] ?? src;
    const parts = pathOnly.split("/");
    return decodeURIComponent(parts[parts.length - 1] ?? src);
  } catch {
    return src;
  }
}

export type HomeFrameSlide = {
  kind: "image";
  src: string;
  width: number;
  height: number;
};

export function getHomeFrameSlides(): HomeFrameSlide[] {
  const images = WORK_CATALOG.filter(
    (i) =>
      i.kind === "image" &&
      i.src.startsWith("/images/work/") &&
      !i.src.includes("site-040.jpg") &&
      !/\/(manual-review|site-pull|site-pull-cropped|site-pull-duplicates|unsorted|youtube-posters|video-posters)\//.test(
        i.src
      )
  );
  const byBase = new Map(images.map((i) => [basename(i.src), i]));
  const used = new Set<string>();
  const out: HomeFrameSlide[] = [];

  const push = (item: (typeof images)[number] | undefined) => {
    if (!item || used.has(item.src) || out.length >= MAX_SLIDES) return;
    used.add(item.src);
    out.push({
      kind: "image",
      src: item.src,
      width: item.width && item.width > 0 ? item.width : 4,
      height: item.height && item.height > 0 ? item.height : 5,
    });
  };

  for (const name of PREFERRED) {
    push(byBase.get(name));
  }

  const sectionOnce = new Set<string>();
  for (const item of images) {
    if (out.length >= MAX_SLIDES) break;
    const section = item.sectionKey ?? "";
    if (sectionOnce.has(section)) continue;
    sectionOnce.add(section);
    push(item);
  }

  for (const item of images) {
    if (out.length >= MAX_SLIDES) break;
    push(item);
  }

  return out;
}
