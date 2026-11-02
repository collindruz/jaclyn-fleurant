/**
 * Resolve YouTube poster URLs: prefer a clean high-res official thumb.
 * If the only available image has verified letterbox/pillarbox bars, write a
 * derived crop under public/images/work/youtube-posters/ (source thumbs are not modified).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "images", "work", "youtube-posters");

const CANDIDATES = [
  "maxresdefault.jpg",
  "hq720.jpg",
  "sddefault.jpg",
  "hqdefault.jpg",
  "hq2.jpg",
  "mqdefault.jpg",
];

function isNearBlack(r, g, b, a = 255) {
  if (a < 8) return true;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 18;
}

async function fetchThumb(id, name) {
  const url = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${name}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return null;
  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return null;
  }
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 160 || h < 90) return null;
  return { buf, width: w, height: h, name, url };
}

function scanBars(data, width, height, channels) {
  const rowBlack = (y) => {
    let dark = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isNearBlack(data[i], data[i + 1], data[i + 2], channels > 3 ? data[i + 3] : 255)) dark++;
    }
    return dark / width >= 0.94;
  };
  const colBlack = (x) => {
    let dark = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * channels;
      if (isNearBlack(data[i], data[i + 1], data[i + 2], channels > 3 ? data[i + 3] : 255)) dark++;
    }
    return dark / height >= 0.94;
  };
  let top = 0;
  while (top < height * 0.34 && rowBlack(top)) top++;
  let bottom = 0;
  while (bottom < height * 0.34 && rowBlack(height - 1 - bottom)) bottom++;
  let left = 0;
  while (left < width * 0.34 && colBlack(left)) left++;
  let right = 0;
  while (right < width * 0.34 && colBlack(width - 1 - right)) right++;
  return { top, bottom, left, right };
}

async function maybeCrop(buf) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bars = scanBars(data, info.width, info.height, info.channels);
  const cropW = info.width - bars.left - bars.right;
  const cropH = info.height - bars.top - bars.bottom;
  const hasH = bars.top >= 8 && bars.bottom >= 8;
  const hasV = bars.left >= 8 && bars.right >= 8;
  if (!hasH && !hasV) return { buf, width: info.width, height: info.height, cropped: false };
  const topBotSkew =
    hasH ? Math.abs(bars.top - bars.bottom) / Math.max(bars.top, bars.bottom) : 0;
  const leftRightSkew =
    hasV ? Math.abs(bars.left - bars.right) / Math.max(bars.left, bars.right) : 0;
  if (topBotSkew > 0.28 || leftRightSkew > 0.28) {
    return { buf, width: info.width, height: info.height, cropped: false, skipped: "uneven-bars" };
  }
  if (cropW < info.width * 0.55 || cropH < info.height * 0.55) {
    return { buf, width: info.width, height: info.height, cropped: false, skipped: "crop-too-aggressive" };
  }
  const out = await sharp(buf)
    .extract({
      left: bars.left,
      top: bars.top,
      width: cropW,
      height: cropH,
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(out).metadata();
  return {
    buf: out,
    width: meta.width,
    height: meta.height,
    cropped: true,
    bars,
  };
}

export async function resolveYouTubePosters(externalEntries) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = [];
  const byId = new Map();

  for (const ext of externalEntries) {
    if (ext.provider !== "youtube") continue;
    const id = ext.id;
    const preferPortrait =
      /\/shorts\//i.test(String(ext.watchUrl || "")) ||
      (Number(ext.width) > 0 && Number(ext.height) > Number(ext.width));
    const found = [];
    for (const name of CANDIDATES) {
      try {
        const t = await fetchThumb(id, name);
        if (t) found.push(t);
      } catch {
        /* skip */
      }
    }
    let chosen = null;
    if (preferPortrait) {
      const portrait = found.filter((t) => t.height >= t.width);
      chosen = (portrait.length ? portrait : found).sort(
        (a, b) => b.width * b.height - a.width * a.height
      )[0];
    } else {
      chosen = found.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    }
    if (!chosen) {
      report.push({ id, title: ext.title, status: "unresolved", note: "No usable YouTube thumbnail" });
      continue;
    }
    const crop = await maybeCrop(chosen.buf);
    if (crop.cropped) {
      const file = `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.jpg`;
      const abs = path.join(OUT_DIR, file);
      fs.writeFileSync(abs, crop.buf);
      const poster = `/images/work/youtube-posters/${file}`;
      byId.set(id, {
        poster,
        posterWidth: crop.width,
        posterHeight: crop.height,
      });
      report.push({
        id,
        title: ext.title,
        status: "derived-crop",
        source: chosen.name,
        size: `${crop.width}x${crop.height}`,
        bars: crop.bars,
      });
      continue;
    }
    if (crop.skipped) {
      byId.set(id, {
        poster: chosen.url,
        posterWidth: chosen.width,
        posterHeight: chosen.height,
      });
      report.push({
        id,
        title: ext.title,
        status: "borders-kept",
        source: chosen.name,
        size: `${chosen.width}x${chosen.height}`,
        note: crop.skipped,
      });
      continue;
    }
    byId.set(id, {
      poster: chosen.url,
      posterWidth: chosen.width,
      posterHeight: chosen.height,
    });
    report.push({
      id,
      title: ext.title,
      status: "official",
      source: chosen.name,
      size: `${chosen.width}x${chosen.height}`,
    });
  }

  return { byId, report };
}
