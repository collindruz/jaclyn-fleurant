/**
 * Regenerate `lib/site-pull-files.ts` from filenames actually present in
 * `public/images/work/site-pull` (sorted). Does not move, delete, or dedupe files.
 *
 * Run: npm run work:sync-files
 * Then: npm run color:group
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SITE_PULL = path.join(ROOT, "public", "images", "work", "site-pull");
const SITE_PULL_FILES = path.join(ROOT, "lib", "site-pull-files.ts");

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function isImageName(name) {
  return IMG_EXT.has(path.extname(name).toLowerCase());
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
 * Filenames in \`public/images/work/site-pull\` (regenerate with \`npm run work:sync-files\` or
 * \`npm run work:dedupe\` / \`npm run pull:site-images\`).
 * @generated ${new Date().toISOString()}
 */
export const SITE_PULL_FILENAMES = [${body}] as const;

/**
 * Homepage small frame only — hand-pick stills that read well at ~4:5 in \`object-contain\` (portrait
 * or mild vertical, no extreme panoramas, no obvious type/logos, no tight detail-only crops, no
 * video). Entries not still in \`site-pull\` are dropped when this list is synced.
 * If empty, the UI falls back to the shared placeholder.
 */
export const HOMEPAGE_FRAME_FILENAMES: readonly string[] = [${homeBody}];
`;
  fs.writeFileSync(SITE_PULL_FILES, out, "utf8");
}

function main() {
  if (!fs.existsSync(SITE_PULL)) {
    console.error(`[work:sync-files] Missing: ${SITE_PULL}`);
    process.exit(1);
  }

  const names = fs
    .readdirSync(SITE_PULL, { withFileTypes: true })
    .filter((e) => e.isFile() && isImageName(e.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

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

  const urlUnsafe = names.filter((n) => /[\s#%?]/.test(n));
  if (urlUnsafe.length) {
    console.warn(
      `[work:sync-files] ${urlUnsafe.length} file(s) have spaces or special chars (break image src). ` +
        `Rename e.g. \`site-010 2.jpg\` → \`site-010-2.jpg\`, then re-run this script and color:group.`
    );
  }

  writeSitePullFilesTs(names, oldHome);
  console.log(
    `[work:sync-files] Wrote ${names.length} filenames to ${path.relative(ROOT, SITE_PULL_FILES)}`
  );
  console.log("[work:sync-files] Next: npm run color:group");
}

main();
