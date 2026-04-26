/**
 * Detect the main person in each work image, crop, and save (no color grouping).
 *
 * Only images with a confident person detection are written to the output folder.
 * No center / fallback crops.
 *
 * Input:  public/images/work/site-pull
 * Output: public/images/work/site-pull-cropped
 * Log:    public/debug/work-crop-log.json
 *
 * Run: npm run crop:people
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const tf = require("@tensorflow/tfjs");
const cocossd = require("@tensorflow-models/coco-ssd");

function rgbBufferToTensor3d(data, w, h, channels) {
  const src = data instanceof Uint8Array ? data : new Uint8Array(data);
  const out = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const s = i * channels;
    const d = i * 3;
    out[d] = src[s];
    out[d + 1] = src[s + 1];
    out[d + 2] = src[s + 2];
  }
  return tf.tensor3d(out, [h, w, 3]);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IN_DIR = path.join(ROOT, "public", "images", "work", "site-pull");
const OUT_DIR = path.join(ROOT, "public", "images", "work", "site-pull-cropped");
const LOG_PATH = path.join(ROOT, "public", "debug", "work-crop-log.json");

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

const DETECT_MAX_WIDTH = 800;
const PERSON_MIN_SCORE = 0.32;
const PERSON_PAD_FR = 0.03;

function isImageFile(e) {
  if (!e.isFile()) return false;
  return IMG_EXT.has(path.extname(e.name).toLowerCase());
}

function clampIntRect(left, top, w, h, maxW, maxH) {
  const l = Math.max(0, Math.floor(left));
  const t = Math.max(0, Math.floor(top));
  const wi = Math.max(1, Math.min(Math.floor(w), maxW - l));
  const hi = Math.max(1, Math.min(Math.floor(h), maxH - t));
  return { left: l, top: t, width: wi, height: hi };
}

function detBoxToOrig(x, y, bw, bh, detW, detH, origW, origH) {
  const sx = origW / detW;
  const sy = origH / detH;
  return {
    left: x * sx,
    top: y * sy,
    width: bw * sx,
    height: bh * sy,
  };
}

/**
 * @param {Array<{ class: string; score: number; bbox: [number, number, number, number] }>} predictions
 */
function pickLargestPerson(predictions, minScore) {
  const people = predictions.filter(
    (p) => p.class === "person" && p.score >= minScore
  );
  if (!people.length) return null;
  let best = people[0];
  let a = best.bbox[2] * best.bbox[3];
  for (let i = 1; i < people.length; i++) {
    const p = people[i];
    const ar = p.bbox[2] * p.bbox[3];
    if (ar > a) {
      best = p;
      a = ar;
    }
  }
  return best;
}

/**
 * @param {string} inPath
 * @param {string} outPath
 * @param {{ left: number; top: number; width: number; height: number }} rect
 */
async function writeCrop(inPath, outPath, rect) {
  const ext = path.extname(outPath).toLowerCase();
  const pipeline = sharp(inPath).rotate().extract(rect);

  if (ext === ".png") {
    await pipeline.png().toFile(outPath);
  } else if (ext === ".webp") {
    await pipeline.webp({ quality: 90 }).toFile(outPath);
  } else if (ext === ".gif") {
    await pipeline.gif().toFile(outPath);
  } else if (ext === ".avif") {
    await pipeline.avif({ quality: 70 }).toFile(outPath);
  } else {
    await pipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(outPath);
  }
}

function relFromRoot(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

/**
 * @param {{ bbox: [number, number, number, number] }} person
 * @param {number} ow
 * @param {number} oh
 * @param {number} dW2
 * @param {number} dH2
 */
function personBoxToPaddedRect(person, ow, oh, dW2, dH2) {
  const [bx, by, bw, bh] = person.bbox;
  const o = detBoxToOrig(bx, by, bw, bh, dW2, dH2, ow, oh);
  const m = Math.min(ow, oh);
  const pad = PERSON_PAD_FR * m;
  let pl = o.left - pad;
  let pt = o.top - pad;
  let pw = o.width + 2 * pad;
  let ph = o.height + 2 * pad;
  pl = Math.max(0, pl);
  pt = Math.max(0, pt);
  if (pl + pw > ow) pw = ow - pl;
  if (pt + ph > oh) ph = oh - pt;
  if (pw < 2 || ph < 2) {
    return null;
  }
  return clampIntRect(pl, pt, pw, ph, ow, oh);
}

/**
 * @param {unknown} personModel
 * @param {string} inPath
 * @param {number} ow
 * @param {number} oh
 * @returns {Promise<
 *   | { ok: true; rect: { left: number; top: number; width: number; height: number }; score: number }
 *   | { ok: false; reason: "no-person-skipped" | "invalid-crop" | "detection-error"; message?: string }
 * >}
 */
async function detectPersonCropRect(personModel, inPath, ow, oh) {
  let imageTensor = null;
  try {
    const { data: detData, info: dInfo } = await sharp(inPath)
      .rotate()
      .resize({
        width: DETECT_MAX_WIDTH,
        withoutEnlargement: true,
        fit: "inside",
      })
      .ensureAlpha()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const dW2 = dInfo.width || 1;
    const dH2 = dInfo.height || 1;
    const dCh = dInfo.channels || 3;
    imageTensor = rgbBufferToTensor3d(detData, dW2, dH2, dCh);
    const pred = await personModel.detect(imageTensor, 25, PERSON_MIN_SCORE);
    imageTensor.dispose();
    imageTensor = null;

    const person = pickLargestPerson(pred, PERSON_MIN_SCORE);
    if (!person) {
      return { ok: false, reason: "no-person-skipped" };
    }

    const rect = personBoxToPaddedRect(person, ow, oh, dW2, dH2);
    if (!rect) {
      return { ok: false, reason: "invalid-crop" };
    }

    return {
      ok: true,
      rect,
      score: Math.round(person.score * 10000) / 10000,
    };
  } catch (e) {
    if (imageTensor) {
      try {
        imageTensor.dispose();
      } catch {
        // ignore
      }
    }
    return {
      ok: false,
      reason: "detection-error",
      message: e?.message || String(e),
    };
  }
}

function logSkipped(
  name,
  /** @type { "no-person-skipped" | "invalid-crop" | "detection-error" | "model-load-failed" } */ reason,
  message
) {
  const o = {
    filename: name,
    included: false,
    cropMethod: "skipped",
    reason,
  };
  if (message) o.message = message;
  return o;
}

function logSuccess(name, rect, personScore) {
  return {
    filename: name,
    included: true,
    cropMethod: "person-detect",
    reason: "person-detected",
    cropDimensions: { ...rect },
    personScore,
  };
}

async function main() {
  if (!fs.existsSync(IN_DIR)) {
    console.warn(`[crop-work-people] Missing input: ${IN_DIR}`);
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.writeFileSync(
      LOG_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          inputDir: relFromRoot(IN_DIR),
          outputDir: relFromRoot(OUT_DIR),
          files: [],
          error: "missing-input-dir",
        },
        null,
        2
      ),
      "utf8"
    );
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

  const names = fs
    .readdirSync(IN_DIR, { withFileTypes: true })
    .filter(isImageFile)
    .map((d) => d.name)
    .sort();

  const fileLogs = [];

  let personModel = null;
  try {
    await tf.setBackend("cpu");
    await tf.ready();
    personModel = await cocossd.load();
    console.log("[crop-work-people] COCO-SSD ready (tfjs CPU).");
  } catch (e) {
    const msg = e?.message || String(e);
    console.warn(
      `[crop-work-people] Model load failed — no crops will be written. ${msg}`
    );
    for (const name of names) {
      fileLogs.push(logSkipped(name, "model-load-failed", msg));
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      inputDir: relFromRoot(IN_DIR),
      outputDir: relFromRoot(OUT_DIR),
      detectMaxWidth: DETECT_MAX_WIDTH,
      personMinScore: PERSON_MIN_SCORE,
      modelLoaded: false,
      summary: {
        total: names.length,
        included: 0,
        skipped: names.length,
      },
      files: fileLogs,
    };
    fs.writeFileSync(LOG_PATH, JSON.stringify(payload, null, 2), "utf8");
    console.log(
      `[crop-work-people] Wrote 0 crops; ${names.length} skipped (model-load-failed). Log: ${relFromRoot(LOG_PATH)}`
    );
    return;
  }

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const inPath = path.join(IN_DIR, name);
    const outPath = path.join(OUT_DIR, name);

    if (i % 30 === 0) {
      console.log(`[crop-work-people] ${i + 1}/${names.length}…`);
    }

    let meta;
    try {
      meta = await sharp(inPath).rotate().metadata();
    } catch (e) {
      fileLogs.push(
        logSkipped(
          name,
          "detection-error",
          `Failed to read image: ${e?.message || String(e)}`
        )
      );
      continue;
    }

    const ow = meta.width || 1;
    const oh = meta.height || 1;

    const res = await detectPersonCropRect(personModel, inPath, ow, oh);
    if (!res.ok) {
      const entry = logSkipped(
        name,
        res.reason,
        "message" in res ? res.message : undefined
      );
      fileLogs.push(entry);
      continue;
    }

    try {
      await writeCrop(inPath, outPath, res.rect);
    } catch (e) {
      fileLogs.push(
        logSkipped(
          name,
          "detection-error",
          `Write failed: ${e?.message || String(e)}`
        )
      );
      continue;
    }

    fileLogs.push(logSuccess(name, res.rect, res.score));
  }

  const includedN = fileLogs.filter((f) => f.included).length;
  const skippedN = fileLogs.length - includedN;

  const payload = {
    generatedAt: new Date().toISOString(),
    inputDir: relFromRoot(IN_DIR),
    outputDir: relFromRoot(OUT_DIR),
    detectMaxWidth: DETECT_MAX_WIDTH,
    personMinScore: PERSON_MIN_SCORE,
    modelLoaded: true,
    summary: {
      total: fileLogs.length,
      included: includedN,
      skipped: skippedN,
    },
    files: fileLogs,
  };

  fs.writeFileSync(LOG_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `[crop-work-people] Saved ${includedN} crop(s) to ${relFromRoot(OUT_DIR)}; ` +
      `skipped ${skippedN}. Log: ${relFromRoot(LOG_PATH)}`
  );

  if (personModel && typeof personModel.dispose === "function") {
    try {
      personModel.dispose();
    } catch {
      // ignore
    }
  }
}

main().catch((e) => {
  console.error("[crop-work-people] Fatal:", e);
  process.exit(1);
});
