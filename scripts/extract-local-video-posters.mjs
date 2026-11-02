/**
 * Extract each local Work video’s first frame into a JPEG poster.
 * Does not modify or re-encode the source video. Does not seek later frames
 * if the first frame is black/blank — those are flagged instead.
 *
 * Used by `npm run work:catalog`.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const POSTER_ROOT = path.join(ROOT, "public", "images", "work", "video-posters");

export function resolveFfmpeg() {
  if (process.env.FFMPEG && fs.existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  const which = spawnSync("which", ["ffmpeg"], { encoding: "utf8" });
  if (which.status === 0) {
    const p = which.stdout.trim();
    if (p) return p;
  }
  const candidates = [
    "/tmp/jf-ffmpeg/node_modules/ffmpeg-static/ffmpeg",
    "/private/tmp/jf-ffmpeg/node_modules/ffmpeg-static/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function posterBasename(relPosix) {
  const stem = path.posix.basename(relPosix, path.posix.extname(relPosix));
  const safe = stem
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 72);
  if (safe === stem && safe.length > 0) return `${safe}.jpg`;
  const hash = crypto.createHash("sha1").update(relPosix).digest("hex").slice(0, 10);
  return `${safe || "clip"}-${hash}.jpg`;
}

function extractFirstFrame(ffmpeg, videoPath, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const result = spawnSync(
    ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "0",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outPath,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0 || !fs.existsSync(outPath) || fs.statSync(outPath).size < 80) {
    const err = (result.stderr || result.stdout || "ffmpeg failed").trim();
    return { ok: false, error: err.slice(0, 400) };
  }
  return { ok: true };
}

async function blankKind(filePath) {
  const { data, info } = await sharp(filePath)
    .resize({ width: 80, height: 80, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let dark = 0;
  let bright = 0;
  let n = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += ch) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
    n++;
    if (y < 12) dark++;
    if (y > 245) bright++;
  }
  if (!n) return "empty";
  if (dark / n >= 0.97) return "black";
  if (bright / n >= 0.97) return "white";
  if (sum / n < 8) return "black";
  return null;
}

/**
 * @param {Array<{ folder: string, rel: string, full: string, src: string }>} videos
 * @returns {Promise<{ bySrc: Map<string, { poster: string, posterWidth: number, posterHeight: number }>, flags: Array<{ src: string, file: string, reason: string }> }>}
 */
export async function extractLocalVideoPosters(videos) {
  const ffmpeg = resolveFfmpeg();
  const bySrc = new Map();
  const flags = [];
  if (!ffmpeg) {
    flags.push({ src: "*", file: "", reason: "ffmpeg not found — local posters not extracted" });
    console.warn("[work:catalog] ffmpeg not found; local video posters skipped");
    return { bySrc, flags };
  }

  for (const video of videos) {
    const file = posterBasename(video.rel);
    const abs = path.join(POSTER_ROOT, video.folder, file);
    const extracted = extractFirstFrame(ffmpeg, video.full, abs);
    if (!extracted.ok) {
      flags.push({
        src: video.src,
        file: `${video.folder}/${video.rel}`,
        reason: `first-frame extract failed: ${extracted.error}`,
      });
      console.warn(`[work:catalog] poster FAIL ${video.folder}/${video.rel}: ${extracted.error}`);
      continue;
    }
    let meta;
    try {
      meta = await sharp(abs).metadata();
    } catch (err) {
      flags.push({
        src: video.src,
        file: `${video.folder}/${video.rel}`,
        reason: `poster unreadable: ${err?.message || err}`,
      });
      continue;
    }
    const blank = await blankKind(abs);
    if (blank) {
      flags.push({
        src: video.src,
        file: `${video.folder}/${video.rel}`,
        reason: `first frame is ${blank} — left as-is (no later-frame fallback)`,
      });
      console.warn(
        `[work:catalog] BLANK FIRST FRAME ${video.folder}/${video.rel} (${blank})`
      );
    }
    const poster = `/images/work/video-posters/${encodeURIComponent(video.folder)}/${encodeURIComponent(file)}`;
    bySrc.set(video.src, {
      poster,
      posterWidth: meta.width || 0,
      posterHeight: meta.height || 0,
    });
  }

  return { bySrc, flags };
}
