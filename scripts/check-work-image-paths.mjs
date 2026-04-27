/**
 * Parse `lib/work-color-groups.ts`, collect every `src` (Work archive paths),
 * and ensure each file exists under `public/`.
 *
 *   /images/work/site-pull/name.jpg  →  public/images/work/site-pull/name.jpg
 *
 * Run: npm run check:images
 * Exit 1 if any file is missing; prints every missing public path.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WORK_COLOR_GROUPS = path.join(ROOT, "lib", "work-color-groups.ts");

/**
 * @param {string} publicUrl e.g. /images/work/site-pull/site-001.jpg
 * @returns {string} absolute path under repo
 */
function publicPathFromUrl(publicUrl) {
  return path.join(ROOT, "public", ...publicUrl.split("/").filter(Boolean));
}

/**
 * @param {string} tsSource
 * @returns {string[]}
 */
function collectSrcsFromWorkColorGroups(tsSource) {
  const re = /src:\s*["'](\/images\/work\/site-pull\/[^"']+)["']/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(tsSource)) !== null) {
    const s = m[1];
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(WORK_COLOR_GROUPS)) {
    console.error(`[check:images] Missing: ${WORK_COLOR_GROUPS}`);
    process.exit(1);
  }

  const text = fs.readFileSync(WORK_COLOR_GROUPS, "utf8");
  const srcs = collectSrcsFromWorkColorGroups(text);

  const missing = [];
  for (const url of srcs) {
    const disk = publicPathFromUrl(url);
    if (!fs.existsSync(disk)) {
      missing.push(disk);
    }
  }

  if (missing.length) {
    console.error(
      `[check:images] ${missing.length} missing file(s) (from lib/work-color-groups.ts):`
    );
    for (const p of missing) {
      console.error(p);
    }
    process.exit(1);
  }

  console.log(
    `[check:images] OK — ${srcs.length} path(s) in work-color-groups.ts all exist under public/`
  );
}

main();
