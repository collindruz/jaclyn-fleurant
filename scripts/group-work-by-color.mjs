/**
 * Classify work images in `public/images/work/site-pull` by dominant palette.
 * Analyzes the **full frame** (downscaled, fit inside 256px — full image, no letterbox crop).
 * No TensorFlow / person detection.
 *
 * Group size: each image is listed once. After auto-classify, if any group has more than
 * `MAX_IMAGES_PER_GROUP` (30) while the archive has ≤6×30 images, items are rebalanced
 * to the current smallest group (so editorial drift on a few is possible; use COLOR_OVERRIDES).
 * If there are more than 180 images, the per-group cap becomes ceil(n/6) so all files fit.
 * Manual curation (exclude, per-file group moves, featured order) is in `lib/work-curation.json` and applied at
 * runtime in `lib/apply-work-curation.ts` — not here.
 * Run: npm run work:filter:person (optional) then npm run color:group  →  lib/work-color-groups.ts
 *
 * When `lib/work-person-filtered.json` exists (from a successful `work:filter:person` run), only those
 * basenames are classified. If the file is missing, every image in site-pull is used.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SITE_PULL_DIR = path.join(ROOT, "public", "images", "work", "site-pull");
const PERSON_FILTER_JSON = path.join(ROOT, "lib", "work-person-filtered.json");
const OUT_FILE = path.join(ROOT, "lib", "work-color-groups.ts");

const SITE_PULL_URL = "/images/work/site-pull";

/**
 * When total images <= 6 * this value, per-group size is bounded by this.
 * If there are more images than 6 * MAX, the cap is raised so every image is placed.
 * @type {number}
 */
const MAX_IMAGES_PER_GROUP = 30;

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

const KEYS = ["black", "white", "neutral", "warm", "cool", "vivid"];

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
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

/**
 * @param {number[]} angles
 */
function circularHueStdDeg(angles) {
  if (angles.length < 2) return 0;
  const rad = angles.map((deg) => (deg * Math.PI) / 180);
  let sumSin = 0;
  let sumCos = 0;
  for (const r of rad) {
    sumSin += Math.sin(r);
    sumCos += Math.cos(r);
  }
  const n = angles.length;
  const meanSin = sumSin / n;
  const meanCos = sumCos / n;
  const rLen = Math.hypot(meanSin, meanCos);
  if (rLen < 1e-6) return 90;
  const circVar = -2 * Math.log(Math.max(1e-9, rLen));
  return Math.sqrt(Math.max(0, circVar)) * (180 / Math.PI);
}

/**
 * @param {Buffer} data
 * @param {number} w
 * @param {number} h
 * @param {number} channels
 */
function analyzeBuffer(data, w, h, channels) {
  const hues = [];
  const satsSaturated = [];
  const lums = [];
  const satsAll = [];
  let satPixelCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      if (channels === 4) {
        const a = data[i + 3] / 255;
        if (a < 0.1) continue;
        r = Math.round(r * a + 255 * (1 - a));
        g = Math.round(g * a + 255 * (1 - a));
        b = Math.round(b * a + 255 * (1 - a));
      }
      const { h: hue, s, l } = rgbToHsl(r, g, b);
      lums.push(l);
      satsAll.push(s);
      if (s > 0.12) {
        satPixelCount++;
        hues.push(hue);
        satsSaturated.push(s);
      }
    }
  }

  const n = lums.length;
  const avgL = n ? lums.reduce((a, b) => a + b, 0) / n : 0;
  const avgS = n ? satsAll.reduce((a, b) => a + b, 0) / n : 0;
  const stdHue = circularHueStdDeg(hues);
  const satRatio = n ? satPixelCount / n : 0;
  const avgSatSaturated = satsSaturated.length
    ? satsSaturated.reduce((a, b) => a + b, 0) / satsSaturated.length
    : 0;

  let meanHue = 0;
  if (hues.length) {
    let sx = 0;
    let sy = 0;
    for (const ang of hues) {
      const rad = (ang * Math.PI) / 180;
      sx += Math.cos(rad);
      sy += Math.sin(rad);
    }
    meanHue = (Math.atan2(sy, sx) * 180) / Math.PI;
    if (meanHue < 0) meanHue += 360;
  }

  return { meanL: avgL, meanS: avgS, stdHue, meanHue, satRatio, avgSatSaturated };
}

/**
 * @param {ReturnType<typeof analyzeBuffer>} a
 */
function classifyFromStats(a) {
  const { meanL, meanS, stdHue, meanHue, avgSatSaturated } = a;
  const hueDeg = ((meanHue % 360) + 360) % 360;

  if (meanL > 0.86 && meanS < 0.16) return "white";
  if (meanL < 0.15) return "black";

  if (meanS < 0.14 && meanL > 0.14 && meanL < 0.88) return "neutral";
  if (meanS < 0.2 && stdHue < 30 && meanL > 0.16 && meanL < 0.9) {
    return "neutral";
  }
  if (hueDeg >= 12 && hueDeg <= 68 && meanS < 0.5 && meanL > 0.2 && meanL < 0.8) {
    return "neutral";
  }

  if (meanS >= 0.35 || avgSatSaturated > 0.42) {
    if (meanL < 0.92 && meanL > 0.1) return "vivid";
  }
  if (stdHue < 32 && meanS > 0.3 && meanL > 0.15 && meanL < 0.9) {
    return "vivid";
  }

  if (isWarmHue(hueDeg)) return "warm";
  if (isCoolHue(hueDeg)) return "cool";

  return "neutral";
}

/** @param {number} h */
function isWarmHue(h) {
  return h <= 105 || h >= 300;
}

/** @param {number} h */
function isCoolHue(h) {
  return h > 105 && h < 300;
}

/**
 * Full image, downscaled (fit: inside) for speed — no cropping.
 * @param {string} filePath
 */
async function getFullImagePixelsForAnalysis(filePath) {
  return sharp(filePath)
    .rotate()
    .resize({ width: 256, height: 256, fit: "inside" })
    .ensureAlpha()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function classifyImageToGroupKey(filePath) {
  const { data, info } = await getFullImagePixelsForAnalysis(filePath);
  const w = info.width;
  const imH = info.height;
  const ch = info.channels;
  if (!w || !imH || ch < 3) return "neutral";
  const buf = analyzeBuffer(data, w, imH, ch);
  return classifyFromStats(buf);
}

/**
 * Shrink any group that exceeds the cap; move one item at a time to the current smallest group.
 * No duplicate `src` values: each file appears in exactly one list before/after.
 * @param {Record<string, { kind: string; src: string }[]>} groups
 * @param {number} totalN
 */
function capGroupSizes(groups, totalN) {
  if (totalN === 0) return;
  const perGroupMax =
    totalN > MAX_IMAGES_PER_GROUP * KEYS.length
      ? Math.ceil(totalN / KEYS.length)
      : MAX_IMAGES_PER_GROUP;

  const maxIters = totalN * 4 + 20;
  for (let i = 0; i < maxIters; i++) {
    const over = KEYS.filter((k) => groups[k].length > perGroupMax);
    if (over.length === 0) return;
    const fromK = over.reduce(
      (a, b) => (groups[a].length >= groups[b].length ? a : b)
    );
    if (groups[fromK].length <= perGroupMax) return;
    const toK = KEYS.reduce((a, b) =>
      groups[a].length < groups[b].length ? a : b
    );
    const item = groups[fromK].pop();
    if (item) {
      if (toK === fromK) break;
      groups[toK].push(item);
    }
  }
}

/**
 * @param {import("fs").Dirent} e
 */
function isImageFile(e) {
  if (!e.isFile()) return false;
  const ext = path.extname(e.name).toLowerCase();
  return IMG_EXT.has(ext);
}

/**
 * Deduplicate by `src` (defensive).
 * @param {Record<string, { kind: string; src: string }[]>} groups
 */
function assertUniqueSrc(groups) {
  const seen = new Set();
  for (const k of KEYS) {
    for (const it of groups[k]) {
      if (seen.has(it.src)) {
        throw new Error(`[color:group] duplicate src: ${it.src}`);
      }
      seen.add(it.src);
    }
  }
}

async function main() {
  if (!fs.existsSync(SITE_PULL_DIR)) {
    console.warn(
      `[color:group] Missing folder ${SITE_PULL_DIR} — writing empty groups.`
    );
    const empty = Object.fromEntries(
      KEYS.map((k) => [k, []])
    );
    writeTs(empty, ["  (no source folder)"], 0);
    return;
  }

  const files = fs
    .readdirSync(SITE_PULL_DIR, { withFileTypes: true })
    .filter(isImageFile);
  let names = files.map((d) => d.name).sort();

  if (fs.existsSync(PERSON_FILTER_JSON)) {
    try {
      const data = JSON.parse(
        fs.readFileSync(PERSON_FILTER_JSON, "utf8")
      );
      const allow = new Set(
        Array.isArray(data.filenames) ? data.filenames : []
      );
      if (allow.size > 0) {
        const before = names.length;
        names = names.filter((n) => allow.has(n));
        const missing = [...allow].filter((n) => !files.some((d) => d.name === n));
        if (missing.length) {
          console.warn(
            `[color:group] ${missing.length} name(s) in work-person-filtered.json not found on disk (skipped in filter).`
          );
        }
        console.log(
          `[color:group] Person list: ${before} on disk → ${names.length} in color groups`
        );
      } else {
        console.warn(
          `[color:group] work-person-filtered.json has an empty "filenames" array — 0 images to classify.`
        );
        names = [];
      }
    } catch (e) {
      console.warn(
        `[color:group] Could not read work-person-filtered.json (${e?.message || e}) — using all site-pull files.`
      );
    }
  } else {
    console.warn(
      `[color:group] No work-person-filtered.json — classifying all ${names.length} site-pull file(s). Run npm run work:filter:person to restrict to person images first.`
    );
  }

  const groups = {
    black: [],
    white: [],
    neutral: [],
    warm: [],
    cool: [],
    vivid: [],
  };

  const logLines = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (i % 25 === 0) {
      console.log(`[color:group] ${i + 1}/${names.length}…`);
    }
    const full = path.join(SITE_PULL_DIR, name);
    let key;
    try {
      key = await classifyImageToGroupKey(full);
      logLines.push(`  ${name} → ${key}`);
    } catch (err) {
      console.warn(`[color:group] ${name}: ${err?.message || err} → neutral`);
      key = "neutral";
      logLines.push(`  ${name} → neutral (error)`);
    }

    if (!key || !KEYS.includes(key)) key = "neutral";

    groups[key].push({
      kind: "image",
      src: `${SITE_PULL_URL}/${name}`,
    });
  }

  const totalItems = Object.values(groups).reduce((s, a) => s + a.length, 0);
  capGroupSizes(groups, totalItems);
  try {
    assertUniqueSrc(groups);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  writeTs(groups, logLines, names.length);
  console.log(`[color:group] Wrote ${OUT_FILE} (${names.length} images, unique, capped).`);
}

/**
 * @param {Record<string, { kind: string; src: string }[]>} groups
 * @param {string[]} logLines
 * @param {number} count
 */
function writeTs(groups, logLines, count) {
  const items = (arr) => {
    if (!arr.length) return "[]";
    return (
      "[\n" +
      arr
        .map(
          (it) =>
            `    { kind: "image" as const, src: ${JSON.stringify(it.src)} }`
        )
        .join(",\n") +
      ",\n  ]"
    );
  };

  const body = KEYS.map((k) => `  ${k}: ${items(groups[k] || [])},`).join("\n");

  const header = `/**
 * Auto-generated by \`npm run color:group\` — do not edit by hand.
 * Source: public/images/work/site-pull (see work-person-filtered.json when present; auto palette, no crop).
 * Curation: lib/work-curation.json → applyWorkCuration() in the app.
 * Images analyzed: ${count}
 * @generated ${new Date().toISOString()}
 */

import type { WorkItem } from "./work-types";
import type { WorkColorKey } from "./work-types";

export const workColorGroups: Record<WorkColorKey, WorkItem[]> = {
${body}
};

/*
Classification log (last run):
${logLines.join("\n") || "  (none)"}
*/
`;

  fs.writeFileSync(OUT_FILE, header, "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
