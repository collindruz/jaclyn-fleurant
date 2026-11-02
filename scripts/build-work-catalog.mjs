/**
 * Build lib/work-catalog.ts from categorized folders under public/images/work
 * plus emailed YouTube/Vimeo links. Does not move or rename source files.
 *
 * Run: npm run work:catalog
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { applyWorkProjects, loadWorkProjectsFile } from "./apply-work-projects.mjs";
import { resolveYouTubePosters } from "./prepare-youtube-posters.mjs";
import { extractLocalVideoPosters } from "./extract-local-video-posters.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORK_ROOT = path.join(ROOT, "public", "images", "work");
const OUT_FILE = path.join(ROOT, "lib", "work-catalog.ts");

const SECTION_FOLDERS = [
  { folder: "editorial", key: "editorial" },
  { folder: "costume-design", key: "costumeDesign" },
  { folder: "advertising", key: "advertising" },
  { folder: "music-videos", key: "musicVideos" },
  { folder: "events", key: "events" },
];

const SKIP_DIRS = new Set([
  "manual-review",
  "site-pull",
  "site-pull-cropped",
  "site-pull-duplicates",
  "unsorted",
  "youtube-posters",
  "video-posters",
]);

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".m4v", ".mov"]);
const KEYS = ["black", "white", "neutral", "warm", "cool", "vivid"];
const INFO_RESERVED = new Set(["site-040.jpg"]);

/** @type {Array<{section: string, watchUrl: string, provider: string, id: string, title: string, poster: string, width: number, height: number, embeddable: boolean, embedUrl: string | null, notes?: string}>} */
const EXTERNAL = [
  {
    section: "advertising",
    watchUrl: "https://vimeo.com/1027075641",
    provider: "vimeo",
    id: "1027075641",
    title: "Reebok | Through the Fire | Director's Cut",
    poster:
      "https://i.vimeocdn.com/video/1946978911-4b1472762ee1d4996ced7ea91ef06d513f9cde523d6361491fae1215309b2c63-d_640",
    width: 426,
    height: 240,
    embeddable: true,
    embedUrl: "https://player.vimeo.com/video/1027075641",
    notes: "Commercial / director's cut. oEmbed OK (page fetch 403 without API).",
  },
  {
    section: "advertising",
    watchUrl: "https://www.youtube.com/watch?v=sRRUl9sJZtQ",
    provider: "youtube",
    id: "sRRUl9sJZtQ",
    title: "【SS26】「BORN CLASSIC. WORN FOR LIFE.」 London 【WORKOUT PLUS】",
    poster: "https://i.ytimg.com/vi/sRRUl9sJZtQ/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/sRRUl9sJZtQ",
  },
  {
    section: "advertising",
    watchUrl: "https://www.youtube.com/watch?v=g4N97ZjaErk",
    provider: "youtube",
    id: "g4N97ZjaErk",
    title: "Clorox Scentiva in Cherry Blossom & Peach",
    poster: "https://i.ytimg.com/vi/g4N97ZjaErk/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/g4N97ZjaErk",
  },
  {
    section: "advertising",
    watchUrl: "https://www.youtube.com/watch?v=m8khk9vB86k",
    provider: "youtube",
    id: "m8khk9vB86k",
    title: "FloatZig 1 Running Hack",
    poster: "https://i.ytimg.com/vi/m8khk9vB86k/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/m8khk9vB86k",
    notes: "Reebok FloatZig family (related IDs kept as separate spots).",
  },
  {
    section: "advertising",
    watchUrl: "https://www.youtube.com/watch?v=PBP0NPpHcMw",
    provider: "youtube",
    id: "PBP0NPpHcMw",
    title: "Reebok FloatZig 1 Running Hack",
    poster: "https://i.ytimg.com/vi/PBP0NPpHcMw/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/PBP0NPpHcMw",
    notes: "Reebok FloatZig family.",
  },
  {
    section: "advertising",
    watchUrl: "https://www.youtube.com/watch?v=ctvMtHp74rY",
    provider: "youtube",
    id: "ctvMtHp74rY",
    title: "Reebok FloatZig 1 Running Hack",
    poster: "https://i.ytimg.com/vi/ctvMtHp74rY/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/ctvMtHp74rY",
    notes: "Reebok FloatZig family.",
  },
  {
    section: "advertising",
    watchUrl: "https://www.youtube.com/watch?v=BdESXmQ-nGA",
    provider: "youtube",
    id: "BdESXmQ-nGA",
    title: "Reebok FloatZig 1 Running Hack",
    poster: "https://i.ytimg.com/vi/BdESXmQ-nGA/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/BdESXmQ-nGA",
    notes: "Reebok FloatZig family.",
  },
  {
    section: "costumeDesign",
    watchUrl: "https://www.youtube.com/watch?v=fxSmTkcOvcM",
    provider: "youtube",
    id: "fxSmTkcOvcM",
    title: "Don Toliver Delivers a Show-Stopping Performance of \"E85\" & \"Body\" | BET Awards '26",
    poster: "https://i.ytimg.com/vi/fxSmTkcOvcM/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/fxSmTkcOvcM",
  },
  {
    section: "costumeDesign",
    watchUrl: "https://www.youtube.com/watch?v=fB8qvx0HOlI",
    provider: "youtube",
    id: "fB8qvx0HOlI",
    title: "Homecoming: A Film By Beyoncé | Official Trailer | Netflix",
    poster: "https://i.ytimg.com/vi/fB8qvx0HOlI/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/fB8qvx0HOlI",
  },
  {
    section: "costumeDesign",
    watchUrl: "https://www.youtube.com/watch?v=RihnnP1k1rw",
    provider: "youtube",
    id: "RihnnP1k1rw",
    title: "Mariah The Scientist – Burning Blue",
    poster: "https://i.ytimg.com/vi/RihnnP1k1rw/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/RihnnP1k1rw",
  },
  {
    section: "costumeDesign",
    watchUrl: "https://www.youtube.com/watch?v=eVib1QhV86I",
    provider: "youtube",
    id: "eVib1QhV86I",
    title: "Mariah the Scientist Performs “Rainy Days” & “Is it a Crime” With Kali Uchis | WIM 2026",
    poster: "https://i.ytimg.com/vi/eVib1QhV86I/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/eVib1QhV86I",
  },
  {
    section: "costumeDesign",
    watchUrl: "https://www.youtube.com/shorts/-p83jyXsL_k",
    provider: "youtube",
    id: "-p83jyXsL_k",
    title: "#MariahTheScientist performs “Rainy Days” off of Hearts Sold Separately! #FallonTonight",
    poster: "https://i.ytimg.com/vi/-p83jyXsL_k/hq2.jpg",
    width: 9,
    height: 16,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/-p83jyXsL_k",
    notes: "YouTube Short (vertical).",
  },
  {
    section: "musicVideos",
    watchUrl: "https://www.youtube.com/watch?v=L5agl9ioLRM",
    provider: "youtube",
    id: "L5agl9ioLRM",
    title: "Mariah the Scientist, Kali Uchis - Is It a Crime (Official Music Video)",
    poster: "https://i.ytimg.com/vi/L5agl9ioLRM/hqdefault.jpg",
    width: 4,
    height: 3,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/L5agl9ioLRM",
  },
  {
    section: "musicVideos",
    watchUrl: "https://www.youtube.com/watch?v=Jx9h3iWudTU",
    provider: "youtube",
    id: "Jx9h3iWudTU",
    title: "Mariah the Scientist - Burning Blue (Official Music Video)",
    poster: "https://i.ytimg.com/vi/Jx9h3iWudTU/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/Jx9h3iWudTU",
  },
  {
    section: "musicVideos",
    watchUrl: "https://www.youtube.com/watch?v=8zxzlAyMg2U",
    provider: "youtube",
    id: "8zxzlAyMg2U",
    title: "Anderson .Paak, Cordae - A Good Day (Official Video)",
    poster: "https://i.ytimg.com/vi/8zxzlAyMg2U/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/8zxzlAyMg2U",
  },
  {
    section: "musicVideos",
    watchUrl: "https://www.youtube.com/watch?v=rVD-zV6ctoM",
    provider: "youtube",
    id: "rVD-zV6ctoM",
    title: "Don Toliver - E85 [Official Video]",
    poster: "https://i.ytimg.com/vi/rVD-zV6ctoM/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/rVD-zV6ctoM",
  },
  {
    section: "musicVideos",
    watchUrl: "https://www.youtube.com/watch?v=_SrosL0WdOQ",
    provider: "youtube",
    id: "_SrosL0WdOQ",
    title: "Don Toliver - Excavator [Official Video]",
    poster: "https://i.ytimg.com/vi/_SrosL0WdOQ/hqdefault.jpg",
    width: 16,
    height: 9,
    embeddable: true,
    embedUrl: "https://www.youtube.com/embed/_SrosL0WdOQ",
  },
];

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s, l };
}

function classifyFromStats(meanL, meanS) {
  if (meanL > 0.86 && meanS < 0.16) return "white";
  if (meanL < 0.15) return "black";
  if (meanS < 0.14) return "neutral";
  if (meanS >= 0.35) return "vivid";
  return "neutral";
}

async function classifyImage(filePath) {
  const { data, info } = await sharp(filePath)
    .rotate()
    .resize({ width: 96, height: 96, fit: "inside" })
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  let sumL = 0;
  let sumS = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += ch) {
    const { s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    sumL += l;
    sumS += s;
    n++;
  }
  return classifyFromStats(n ? sumL / n : 0, n ? sumS / n : 0);
}

function resolveFfprobe() {
  if (process.env.FFPROBE && fs.existsSync(process.env.FFPROBE)) return process.env.FFPROBE;
  const which = spawnSync("which", ["ffprobe"], { encoding: "utf8" });
  if (which.status === 0) {
    const p = which.stdout.trim();
    if (p) return p;
  }
  const candidates = [
    "/tmp/jf-ffmpeg/node_modules/ffprobe-static/bin/darwin/x64/ffprobe",
    "/opt/homebrew/bin/ffprobe",
    "/usr/local/bin/ffprobe",
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

const FFPROBE_BIN = resolveFfprobe();

function probeVideoSize(filePath) {
  if (!FFPROBE_BIN) return null;
  const result = spawnSync(
    FFPROBE_BIN,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout);
    const stream = parsed?.streams?.[0];
    const width = Number(stream?.width);
    const height = Number(stream?.height);
    if (width > 0 && height > 0) return { width, height };
  } catch {
    return null;
  }
  return null;
}

function encodePublicPath(folder, relPosix) {
  return (
    "/images/work/" +
    [folder, ...relPosix.split("/")].map(encodeURIComponent).join("/")
  );
}

function walkMedia(folderAbs) {
  /** @type {string[]} */
  const out = [];
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const nextRel = rel ? `${rel}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(full, nextRel);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (IMG_EXT.has(ext) || VIDEO_EXT.has(ext)) out.push(nextRel.replace(/\\/g, "/"));
      }
    }
  };
  walk(folderAbs, "");
  out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  return out;
}

function jsString(s) {
  return JSON.stringify(s);
}

async function main() {
  /** @type {object[]} */
  const items = [];
  const excluded = [];
  /** @type {Array<{ folder: string, rel: string, full: string, src: string }>} */
  const localVideos = [];

  for (const { folder, key } of SECTION_FOLDERS) {
    const abs = path.join(WORK_ROOT, folder);
    if (!fs.existsSync(abs)) {
      console.warn(`[work:catalog] Missing folder: ${abs}`);
      continue;
    }
    const files = walkMedia(abs);
    for (const rel of files) {
      const base = path.posix.basename(rel);
      if (INFO_RESERVED.has(base)) {
        excluded.push({ reason: "info-reserved", file: `${folder}/${rel}` });
        continue;
      }
      const full = path.join(abs, rel);
      const ext = path.extname(rel).toLowerCase();
      const isVideo = VIDEO_EXT.has(ext);
      let width = isVideo ? 16 : 4;
      let height = isVideo ? 9 : 5;
      let colorKey = isVideo ? "black" : "neutral";
      if (isVideo) {
        const size = probeVideoSize(full);
        if (size) {
          width = size.width;
          height = size.height;
        } else {
          console.warn(`[work:catalog] ${folder}/${rel}: could not probe video size`);
        }
      } else {
        try {
          const meta = await sharp(full).rotate().metadata();
          if (meta.width && meta.height) {
            width = meta.width;
            height = meta.height;
          }
          colorKey = await classifyImage(full);
        } catch (err) {
          console.warn(`[work:catalog] ${folder}/${rel}: ${err?.message || err}`);
        }
      }
      const src = encodePublicPath(folder, rel);
      if (isVideo) {
        localVideos.push({ folder, rel, full, src });
      }
      items.push({
        kind: isVideo ? "video" : "image",
        src,
        width,
        height,
        colorKey,
        sectionKey: key,
      });
    }
  }

  const localPosters = await extractLocalVideoPosters(localVideos);
  for (const item of items) {
    const poster = localPosters.bySrc.get(item.src);
    if (!poster) continue;
    item.poster = poster.poster;
    if (poster.posterWidth) item.posterWidth = poster.posterWidth;
    if (poster.posterHeight) item.posterHeight = poster.posterHeight;
  }
  for (const flag of localPosters.flags) {
    console.warn(`[work:catalog] local poster flag: ${flag.file || flag.src} — ${flag.reason}`);
  }

  const ytPosters = await resolveYouTubePosters(EXTERNAL);
  for (const line of ytPosters.report) {
    console.log(
      `[work:catalog] youtube poster ${line.id}: ${line.status}` +
        (line.source ? ` (${line.source} ${line.size || ""})` : "") +
        (line.note ? ` — ${line.note}` : "")
    );
  }

  for (const ext of EXTERNAL) {
    const yt = ext.provider === "youtube" ? ytPosters.byId.get(ext.id) : null;
    const poster = yt?.poster || ext.poster;
    items.push({
      kind: "video",
      src: ext.watchUrl,
      poster,
      width: ext.width,
      height: ext.height,
      posterWidth: yt?.posterWidth,
      posterHeight: yt?.posterHeight,
      colorKey: "vivid",
      sectionKey: ext.section,
      external: {
        provider: ext.provider,
        id: ext.id,
        watchUrl: ext.watchUrl,
        embedUrl: ext.embedUrl,
        embeddable: ext.embeddable,
        title: ext.title,
      },
    });
  }

  const projectRecords = loadWorkProjectsFile();
  const applied = applyWorkProjects(items, projectRecords);
  for (const w of applied.warnings) console.warn(`[work:catalog] ${w}`);
  const catalogItems = applied.items;

  const lines = catalogItems.map((it) => {
    const extra = [];
    extra.push(`kind: ${jsString(it.kind)} as const`);
    extra.push(`src: ${jsString(it.src)}`);
    extra.push(`width: ${it.width}`);
    extra.push(`height: ${it.height}`);
    extra.push(`colorKey: ${jsString(it.colorKey)} as const`);
    extra.push(`sectionKey: ${jsString(it.sectionKey)} as const`);
    if (it.projectId) extra.push(`projectId: ${jsString(it.projectId)}`);
    if (it.poster) extra.push(`poster: ${jsString(it.poster)}`);
    if (it.posterWidth) extra.push(`posterWidth: ${it.posterWidth}`);
    if (it.posterHeight) extra.push(`posterHeight: ${it.posterHeight}`);
    if (it.external) {
      extra.push(
        `external: { provider: ${jsString(it.external.provider)} as const, id: ${jsString(it.external.id)}, watchUrl: ${jsString(it.external.watchUrl)}, embedUrl: ${it.external.embedUrl ? jsString(it.external.embedUrl) : "null"}, embeddable: ${it.external.embeddable}, title: ${jsString(it.external.title)} }`
      );
    }
    return `  { ${extra.join(", ")} },`;
  });

  const projectLines = applied.projects.map((p) => {
    const extra = [
      `id: ${jsString(p.id)}`,
      `title: ${jsString(p.title)}`,
      `sectionKey: ${jsString(p.section)} as const`,
      `releaseDate: ${p.releaseDate ? jsString(p.releaseDate) : "null"}`,
      `datePrecision: ${p.datePrecision ? jsString(p.datePrecision) : "null"}`,
      `dateSource: ${p.dateSource ? jsString(p.dateSource) : "null"}`,
      `provisional: ${Boolean(p.provisional)}`,
      `assets: ${JSON.stringify(p.assets)} as const`,
    ];
    if (p.coverAsset) extra.push(`coverAsset: ${jsString(p.coverAsset)}`);
    if (p.projectOrder != null) extra.push(`projectOrder: ${p.projectOrder}`);
    if (p.lockOrder) extra.push(`lockOrder: true`);
    if (p.notes) extra.push(`notes: ${jsString(p.notes)}`);
    return `  { ${extra.join(", ")} },`;
  });

  const body = `/**
 * Generated by \`npm run work:catalog\` from categorized folders + emailed video links.
 * Project grouping comes from \`lib/work-projects.json\` (preserved across regenerations).
 * Do not edit by hand. Source files were not renamed or moved.
 * @generated ${new Date().toISOString()}
 */
import type { WorkItem, WorkProjectRecord } from "./work-types";

export const WORK_CATALOG: WorkItem[] = [
${lines.join("\n")}
];

export const WORK_PROJECTS: WorkProjectRecord[] = [
${projectLines.join("\n")}
];

export const WORK_CATALOG_EXCLUSIONS = ${JSON.stringify(excluded, null, 2)} as const;

export const WORK_EXTERNAL_VIDEO_COUNT = ${EXTERNAL.length} as const;
`;

  fs.writeFileSync(OUT_FILE, body, "utf8");
  const local = catalogItems.filter((i) => !i.external).length;
  const extN = catalogItems.filter((i) => i.external).length;
  console.log(
    `[work:catalog] Wrote ${catalogItems.length} items (${local} local, ${extN} emailed) and ${applied.projects.length} projects to lib/work-catalog.ts`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
