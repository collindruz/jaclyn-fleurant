/**
 * One-time or repeated: makes basenames in `public/images/work/site-pull` web-safe.
 * - " … 2.ext" (macOS duplicate) → "-2.ext"
 * - Parentheses, e.g. "foo (1).jpg" → "foo-1.jpg"
 * - Remaining spaces → "-"
 * - Collapses repeated hyphens; lowercases image extensions
 *
 * Exits 1 on collision (target name already exists and is a different file).
 * Run: node scripts/normalize-site-pull-filenames.mjs
 * Then: npm run work:sync-files && npm run color:group
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SITE_PULL = path.join(ROOT, "public", "images", "work", "site-pull");

const IMG_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".JPG",
  ".JPEG",
  ".PNG",
  ".WEBP",
  ".GIF",
  ".AVIF",
]);

function isImageFile(name) {
  return IMG_EXT.has(path.extname(name));
}

/**
 * @param {string} basenameWithExt
 */
function normalizeName(basenameWithExt) {
  const extRaw = path.extname(basenameWithExt);
  let n = basenameWithExt.slice(0, -extRaw.length) + extRaw.toLowerCase();
  n = n.replace(/ 2(\.[^.]+)$/, "-2$1");
  n = n.replace(/\s*\(([^)]+)\)/g, "-$1");
  n = n.replace(/\s+/g, "-");
  n = n.replace(/-+/g, "-");
  n = n.replace(/^-|-$/g, "");
  if (!extRaw) return n;
  const ext = path.extname(n) || extRaw.toLowerCase();
  const base = ext ? n.slice(0, -ext.length) : n;
  return (base + ext).replace(/\.\.+/g, ".");
}

function main() {
  if (!fs.existsSync(SITE_PULL)) {
    console.error(`[normalize-site-pull] Missing: ${SITE_PULL}`);
    process.exit(1);
  }
  const entries = fs
    .readdirSync(SITE_PULL, { withFileTypes: true })
    .filter((e) => e.isFile() && isImageFile(e.name));
  const sorted = entries.map((e) => e.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let count = 0;
  for (const name of sorted) {
    const next = normalizeName(name);
    if (next === name) continue;
    const from = path.join(SITE_PULL, name);
    const to = path.join(SITE_PULL, next);
    if (fs.existsSync(to)) {
      if (name === next) continue;
      const stA = fs.statSync(from);
      const stB = fs.statSync(to);
      if (stA.ino === stB.ino) continue;
      console.error(
        `[normalize-site-pull] Refusing to clobber: ${name} -> ${next} (target exists)`
      );
      process.exit(1);
    }
    fs.renameSync(from, to);
    console.log(`[normalize-site-pull] ${name} -> ${next}`);
    count++;
  }
  if (count === 0) {
    console.log("[normalize-site-pull] No renames needed.");
  } else {
    console.log(`[normalize-site-pull] Renamed ${count} file(s). Next: npm run work:sync-files && npm run color:group`);
  }
}

main();
