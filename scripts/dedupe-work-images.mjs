/**
 * Deduplicate images in public/images/work/site-pull by file hash, then by perceptual aHash
 * (8×8 greyscale, Hamming distance). First filename (sorted) wins. Duplicates are moved to
 * site-pull-duplicates, never deleted. Regenerates lib/site-pull-files.ts from the result.
 *
 * Re-run: npm run work:filter:person && npm run color:group
 *   (person list + work-color-groups are based on current site-pull file set).
 * To only refresh the filename list (no hash dedupe, no file moves), use: npm run work:sync-files
 *
 * Run: npm run work:dedupe
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SITE_PULL = path.join(ROOT, "public", "images", "work", "site-pull");
const DUPES = path.join(ROOT, "public", "images", "work", "site-pull-duplicates");
const LOG = path.join(ROOT, "public", "debug", "work-dedupe-log.json");
const SITE_PULL_FILES = path.join(ROOT, "lib", "site-pull-files.ts");

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
/** aHash: Hamming <= this vs any kept file → treat as near-duplicate. */
const NEAR_HAMMING_MAX = 10;

function isImageName(name) {
  return IMG_EXT.has(path.extname(name).toLowerCase());
}

function sha256File(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * 64-bit average hash (aHash) as bigint.
 * @param {string} filePath
 */
async function aHash64(filePath) {
  const { data } = await sharp(filePath)
    .rotate()
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < 64; i++) sum += data[i];
  const mean = sum / 64;
  let h = 0n;
  for (let i = 0; i < 64; i++) {
    if (data[i] > mean) {
      h |= 1n << BigInt(63 - i);
    }
  }
  return h;
}

/**
 * @param {bigint} a
 * @param {bigint} b
 */
function hamming64(a, b) {
  let v = a ^ b;
  let c = 0;
  while (v) {
    c++;
    v &= v - 1n;
  }
  return c;
}

function relFromRoot(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

/**
 * @param {string} dupeDir
 * @param {string} baseName
 */
function uniqueDestPath(dupeDir, baseName) {
  let p = path.join(dupeDir, baseName);
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);
  for (let n = 2; n < 10_000; n++) {
    p = path.join(dupeDir, `${stem}__dup${n}${ext}`);
    if (!fs.existsSync(p)) return p;
  }
  throw new Error("Could not find unique name in " + dupeDir);
}

/**
 * @param {string} oldText
 * @param {string[]} newPullNames sorted
 */
function parseHomepagePicksFromOldFile(oldText) {
  const m = oldText.match(
    /export const HOMEPAGE_FRAME_FILENAMES[\s\S]*?=\s*\[([\s\S]*?)\]\s*;/
  );
  if (!m) return [];
  const out = [];
  for (const x of m[1].matchAll(/"([^"]+)"/g)) {
    out.push(x[1]);
  }
  return out;
}

/**
 * @param {string[]} names sorted, unique
 * @param {string[]} oldHomePicks
 */
function writeSitePullFilesTs(names, oldHomePicks) {
  const set = new Set(names);
  const home = oldHomePicks.filter((f) => set.has(f));
  const listLines = names.map((n) => `  ${JSON.stringify(n)},`).join("\n");
  const homeLines = home.map((n) => `  ${JSON.stringify(n)},`).join("\n");
  const body = names.length ? `\n${listLines}\n` : "";
  const homeBody = home.length ? `\n${homeLines}\n` : "";

  const out = `/**
 * Filenames in \`public/images/work/site-pull\` (regenerate with \`npm run work:dedupe\` or
 * \`npm run pull:site-images\`).
 * @generated ${new Date().toISOString()}
 */
export const SITE_PULL_FILENAMES = [${body}] as const;

/**
 * Homepage small frame only — hand-pick stills that read well at ~4:5 in \`object-contain\` (portrait
 * or mild vertical, no extreme panoramas, no obvious type/logos, no tight detail-only crops, no
 * video). Entries not still in \`site-pull\` are dropped when the folder is deduped.
 * If empty, the UI falls back to the shared placeholder.
 */
export const HOMEPAGE_FRAME_FILENAMES: readonly string[] = [${homeBody}];
`;
  fs.writeFileSync(SITE_PULL_FILES, out, "utf8");
}

async function main() {
  if (!fs.existsSync(SITE_PULL)) {
    console.error(`[work:dedupe] Missing: ${SITE_PULL}`);
    process.exit(1);
  }
  fs.mkdirSync(DUPES, { recursive: true });
  fs.mkdirSync(path.dirname(LOG), { recursive: true });

  const allNames = fs
    .readdirSync(SITE_PULL, { withFileTypes: true })
    .filter((e) => e.isFile() && isImageName(e.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  /** @type {Map<string, string>} exact sha256 (hex) -> first filename kept */
  const firstExact = new Map();
  /** @type {Array<{ name: string; aHash: bigint; exact: string }>} */
  const kept = [];
  /** @type {Array<{ kept: string; duplicate: string; reason: "exact" | "near" }>} */
  const moves = [];

  let oldHome = [];
  if (fs.existsSync(SITE_PULL_FILES)) {
    try {
      oldHome = parseHomepagePicksFromOldFile(
        fs.readFileSync(SITE_PULL_FILES, "utf8")
      );
    } catch {
      // ignore
    }
  }

  for (const name of allNames) {
    const full = path.join(SITE_PULL, name);
    let buf;
    try {
      buf = fs.readFileSync(full);
    } catch (e) {
      console.warn(`[work:dedupe] skip (read error): ${name} ${e?.message || e}`);
      continue;
    }
    const ex = sha256File(buf);
    if (firstExact.has(ex)) {
      const k = firstExact.get(ex);
      moves.push({ kept: k, duplicate: name, reason: "exact" });
      continue;
    }

    let ph;
    try {
      ph = await aHash64(full);
    } catch (e) {
      console.warn(
        `[work:dedupe] aHash failed for ${name} (${e?.message || e}) — unique synthetic hash, no near-match to others`
      );
      firstExact.set(ex, name);
      const uniquePh = BigInt("0x" + sha256File(buf).slice(0, 16));
      kept.push({ name, aHash: uniquePh, exact: ex });
      continue;
    }

    let nearOf = null;
    for (const row of kept) {
      if (hamming64(ph, row.aHash) <= NEAR_HAMMING_MAX) {
        nearOf = row.name;
        break;
      }
    }
    if (nearOf) {
      moves.push({ kept: nearOf, duplicate: name, reason: "near" });
      firstExact.set(ex, nearOf);
      continue;
    }

    firstExact.set(ex, name);
    kept.push({ name, aHash: ph, exact: ex });
  }

  for (const m of moves) {
    const from = path.join(SITE_PULL, m.duplicate);
    const to = uniqueDestPath(DUPES, m.duplicate);
    try {
      fs.renameSync(from, to);
    } catch (e) {
      console.error(
        `[work:dedupe] move failed: ${m.duplicate} -> ${to}: ${e?.message || e}`
      );
      process.exit(1);
    }
  }

  const remaining = fs
    .readdirSync(SITE_PULL, { withFileTypes: true })
    .filter((e) => e.isFile() && isImageName(e.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  writeSitePullFilesTs(remaining, oldHome);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceDir: relFromRoot(SITE_PULL),
    duplicatesDir: relFromRoot(DUPES),
    sitePullFiles: relFromRoot(SITE_PULL_FILES),
    nearHammingMax: NEAR_HAMMING_MAX,
    totalScanned: allNames.length,
    totalKept: remaining.length,
    totalMoved: moves.length,
    nextSteps:
      "Re-run: npm run work:filter:person && npm run color:group (or work:rebuild:groups) so person filter and color groups match the new site-pull set.",
    moves,
  };
  fs.writeFileSync(LOG, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    `[work:dedupe] Scanned ${allNames.length}, kept ${remaining.length}, moved ${moves.length} to ${relFromRoot(DUPES)}. Log: ${relFromRoot(LOG)}`
  );
  console.log(`[work:dedupe] Regenerated ${relFromRoot(SITE_PULL_FILES)}.`);
  console.log("[work:dedupe] " + payload.nextSteps);
}

main().catch((e) => {
  console.error("[work:dedupe] Fatal:", e);
  process.exit(1);
});
