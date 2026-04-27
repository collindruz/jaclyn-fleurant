/**
 * Verifies that every site-pull image path referenced by the app exists under `public/`.
 * Run: npm run check:images
 *
 * If many paths are missing, assets may be gitignored (`public/images/work/site-pull/*`) and
 * not on the deploy; add a CI step to `npm run pull:site-images` or commit the folder.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SITE_PREFIX = "/images/work/site-pull/";

/**
 * @param {string} urlPath e.g. /images/work/site-pull/site-001.jpg
 */
function publicFileFromUrl(urlPath) {
  const parts = urlPath.split("/").filter(Boolean);
  return path.join(ROOT, "public", ...parts);
}

/**
 * @param {string} file
 * @param {RegExp} re must have capture group 1 = full URL path
 * @param {Set<string>} out
 */
function collectRegex(file, re, out) {
  if (!fs.existsSync(file)) return;
  const t = fs.readFileSync(file, "utf8");
  let m;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(t)) !== null) {
    if (m[1]) out.add(m[1]);
  }
}

/**
 * @param {string} jsonFile
 * @param {Set<string>} out
 */
function collectCuration(jsonFile, out) {
  if (!fs.existsSync(jsonFile)) return;
  const j = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
  const add = (f) => {
    const t = f && String(f).trim();
    if (t) out.add(SITE_PREFIX + t);
  };
  (j.excludeFilenames || []).forEach(add);
  (j.featuredOrder || []).forEach(add);
  Object.keys(j.sectionOverrides || {}).forEach(add);
  Object.keys(j.colorOverrides || {}).forEach(add);
}

function main() {
  const out = new Set();

  const workColor = path.join(ROOT, "lib", "work-color-groups.ts");
  collectRegex(
    workColor,
    /src:\s*["'](\/images\/work\/site-pull\/[^"']+)["']/g,
    out
  );

  const sitePullTs = path.join(ROOT, "lib", "site-pull-files.ts");
  if (fs.existsSync(sitePullTs)) {
    const t = fs.readFileSync(sitePullTs, "utf8");
    for (const m of t.matchAll(
      /"((?:site-)[^"]+?\.(?:jpe?g|png|webp|gif|avif))"/gi
    )) {
      out.add(SITE_PREFIX + m[1]);
    }
  }

  collectRegex(
    path.join(ROOT, "components", "InfoPageStill.tsx"),
    /["'](\/images\/work\/site-pull\/[^"']+)["']/g,
    out
  );

  collectCuration(path.join(ROOT, "lib", "work-curation.json"), out);

  collectRegex(
    path.join(ROOT, "lib", "home-frame-slides.ts"),
    /["'](\/images\/work\/site-pull\/[^"']+)["']/g,
    out
  );
  collectRegex(
    path.join(ROOT, "lib", "placeholders.ts"),
    /["'](\/images\/work\/site-pull\/[^"']+)["']/g,
    out
  );

  const missing = [];
  for (const url of [...out].sort()) {
    if (!url.startsWith(SITE_PREFIX)) continue;
    const disk = publicFileFromUrl(url);
    if (!fs.existsSync(disk)) {
      missing.push({ url, disk });
    }
  }

  if (missing.length) {
    console.error(`[check:images] ${missing.length} missing file(s):`);
    for (const { url, disk } of missing) {
      console.error(`  ${url}`);
      console.error(`    expected: ${disk}`);
    }
    process.exit(1);
  }

  const siteDir = path.join(ROOT, "public", "images", "work", "site-pull");
  const nOnDisk = fs.existsSync(siteDir)
    ? fs
        .readdirSync(siteDir, { withFileTypes: true })
        .filter(
          (d) => d.isFile() && d.name !== ".gitkeep" && d.name !== ".DS_Store"
        ).length
    : 0;
  console.log(
    `[check:images] OK — ${out.size} unique path(s) under /images/work/site-pull checked; ` +
      `${nOnDisk} file(s) on disk in public/images/work/site-pull/`
  );
}

main();
