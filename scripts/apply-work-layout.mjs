/**
 * Apply lib/work-layout.json onto work-projects.json + work-curation.json.
 * Does not rename, move, or delete media files.
 *
 * Run: npm run work:layout
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LAYOUT_FILE = path.join(ROOT, "lib", "work-layout.json");
const PROJECTS_FILE = path.join(ROOT, "lib", "work-projects.json");
const CURATION_FILE = path.join(ROOT, "lib", "work-curation.json");

function basename(src) {
  const clean = String(src).split("?")[0] ?? src;
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    /* keep */
  }
  const i = decoded.lastIndexOf("/");
  return i === -1 ? decoded : decoded.slice(i + 1);
}

function main() {
  if (!fs.existsSync(LAYOUT_FILE)) {
    console.error(`[work:layout] Missing ${LAYOUT_FILE}`);
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_FILE, "utf8"));
  if (!layout?.enabled || !Array.isArray(layout.projects) || layout.projects.length === 0) {
    console.log(
      "[work:layout] Layout is disabled or empty — Work still uses the catalog. Export from /admin first."
    );
    process.exit(0);
  }

  const projectsDoc = JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf8"));
  const curation = JSON.parse(fs.readFileSync(CURATION_FILE, "utf8"));
  const byId = new Map((projectsDoc.projects || []).map((p) => [p.id, p]));
  const used = new Set();
  const nextProjects = [];

  for (const rec of layout.projects) {
    const existing = byId.get(rec.id) || {
      id: rec.id,
      title: rec.title || "Untitled",
      section: rec.sectionKey,
      releaseDate: null,
      datePrecision: null,
      dateSource: null,
      provisional: true,
      assets: [],
    };
    const assets = [];
    for (const src of rec.assets || []) {
      if (used.has(src)) continue;
      used.add(src);
      assets.push(src);
    }
    const indexInSection = nextProjects.filter(
      (p) => p.section === rec.sectionKey
    ).length;
    nextProjects.push({
      ...existing,
      title: rec.title || existing.title,
      section: rec.sectionKey,
      assets,
      assetOrder: [...assets],
      coverAsset: assets[0] || existing.coverAsset,
      lockOrder: true,
      projectOrder: indexInSection,
    });
    byId.delete(rec.id);
  }

  for (const leftover of byId.values()) {
    leftover.assets = (leftover.assets || []).filter((src) => !used.has(src));
    leftover.assetOrder = leftover.assets;
    nextProjects.push(leftover);
  }

  projectsDoc.projects = nextProjects;
  fs.writeFileSync(PROJECTS_FILE, `${JSON.stringify(projectsDoc, null, 2)}\n`);

  const hidden = Array.from(
    new Set((layout.hidden || []).map((f) => String(f).trim()).filter(Boolean))
  );
  curation.excludeFilenames = hidden;
  fs.writeFileSync(CURATION_FILE, `${JSON.stringify(curation, null, 2)}\n`);

  console.log(
    `[work:layout] Applied ${layout.projects.length} project(s), ${hidden.length} hidden filename(s). Files were not moved.`
  );
  console.log("[work:layout] Restart `npm run dev` (or run `npm run work:catalog` if you also want the generated catalog refreshed).");
}

main();
