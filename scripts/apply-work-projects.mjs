/**
 * Apply lib/work-projects.json onto catalog items.
 * Shared by `npm run work:catalog`. Does not move media.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_FILE = path.join(__dirname, "..", "lib", "work-projects.json");

const VIDEO_FIRST_SECTIONS = new Set(["advertising", "musicVideos"]);

export function loadWorkProjectsFile() {
  const raw = JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf8"));
  return Array.isArray(raw.projects) ? raw.projects : [];
}

function basename(src) {
  try {
    src = decodeURIComponent(src.split("?")[0] ?? src);
  } catch {
    /* keep */
  }
  const i = src.lastIndexOf("/");
  return i === -1 ? src : src.slice(i + 1);
}

function keysFor(src) {
  const out = new Set([src]);
  try {
    out.add(decodeURIComponent(src));
  } catch {
    /* keep */
  }
  out.add(basename(src));
  return out;
}

function dateSortValue(releaseDate, precision) {
  if (!releaseDate) return null;
  const m = String(releaseDate).match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : precision === "month" || precision === "day" ? Number(m[2]) : 1;
  const d = m[3] ? Number(m[3]) : 1;
  if (!y) return null;
  return y * 10000 + (mo || 1) * 100 + (d || 1);
}

function projectHasVideo(project, bySrc) {
  return project.assets.some((src) => {
    const item = bySrc.get(src) || [...keysFor(src)].map((k) => bySrc.get(k)).find(Boolean);
    return item && item.kind === "video";
  });
}

function resolveItem(src, indexes) {
  for (const k of keysFor(src)) {
    if (indexes.bySrc.has(k)) return indexes.bySrc.get(k);
    if (indexes.byBase.has(k)) return indexes.byBase.get(k);
  }
  return null;
}

function buildIndexes(items) {
  const bySrc = new Map();
  const byBase = new Map();
  for (const it of items) {
    if (!bySrc.has(it.src)) bySrc.set(it.src, it);
    for (const k of keysFor(it.src)) {
      if (!bySrc.has(k)) bySrc.set(k, it);
    }
    const b = basename(it.src);
    if (!byBase.has(b)) byBase.set(b, it);
  }
  return { bySrc, byBase };
}

function orderAssets(project, items, sectionKey) {
  const listed = project.assetOrder?.length ? project.assetOrder : project.assets;
  const map = new Map(items.map((it) => [it.src, it]));
  const extra = new Map();
  for (const it of items) extra.set(it.src, it);

  const ordered = [];
  const used = new Set();
  for (const src of listed) {
    const it =
      map.get(src) ||
      items.find((i) => keysFor(i.src).has(src) || keysFor(src).has(i.src) || basename(i.src) === basename(src));
    if (it && !used.has(it.src)) {
      ordered.push(it);
      used.add(it.src);
      extra.delete(it.src);
    }
  }
  const rest = [...extra.values()];
  const lockOrder = Boolean(project.lockOrder);
  const videoFirst = !lockOrder && VIDEO_FIRST_SECTIONS.has(sectionKey);
  rest.sort((a, b) => {
    if (videoFirst && a.kind !== b.kind) return a.kind === "video" ? -1 : 1;
    return 0;
  });
  let out = ordered.concat(rest);
  if (videoFirst) {
    out = [
      ...out.filter((i) => i.kind === "video"),
      ...out.filter((i) => i.kind !== "video"),
    ];
  }
  const cover = project.coverAsset;
  if (cover && (lockOrder || !videoFirst)) {
    const idx = out.findIndex(
      (i) => i.src === cover || keysFor(i.src).has(cover) || basename(i.src) === basename(cover)
    );
    if (idx > 0) {
      const [c] = out.splice(idx, 1);
      out.unshift(c);
    }
  }
  return out;
}

function compareProjects(a, b, sectionKey, bySrc) {
  const ao = a.projectOrder;
  const bo = b.projectOrder;
  if (ao != null && bo != null && ao !== bo) return ao - bo;
  if (ao != null && bo == null) return -1;
  if (ao == null && bo != null) return 1;

  if (VIDEO_FIRST_SECTIONS.has(sectionKey)) {
    const av = projectHasVideo(a, bySrc) ? 0 : 1;
    const bv = projectHasVideo(b, bySrc) ? 0 : 1;
    if (av !== bv) return av - bv;
  }

  const ad = dateSortValue(a.releaseDate, a.datePrecision);
  const bd = dateSortValue(b.releaseDate, b.datePrecision);
  const aMissing = ad == null ? 1 : 0;
  const bMissing = bd == null ? 1 : 0;
  if (aMissing !== bMissing) return aMissing - bMissing;
  if (ad != null && bd != null && ad !== bd) return bd - ad;
  const ap = a.provisional ? 1 : 0;
  const bp = b.provisional ? 1 : 0;
  if (ap !== bp) return ap - bp;
  const aCatch = /unidentified/.test(String(a.id)) || a.title === "Untitled stills" ? 1 : 0;
  const bCatch = /unidentified/.test(String(b.id)) || b.title === "Untitled stills" ? 1 : 0;
  if (aCatch !== bCatch) return aCatch - bCatch;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Returns { items, projects, warnings }
 * items: catalog rows with projectId, sorted for Work
 * projects: resolved project records (ordered per section globally as listed)
 */
export function applyWorkProjects(items, projectRecords) {
  const indexes = buildIndexes(items);
  const warnings = [];
  const used = new Set();
  const resolved = [];

  for (const rec of projectRecords) {
    const members = [];
    for (const src of rec.assets || []) {
      const it = resolveItem(src, indexes);
      if (!it) {
        warnings.push(`Project ${rec.id}: missing asset ${src}`);
        continue;
      }
      if (used.has(it.src)) {
        warnings.push(`Project ${rec.id}: duplicate asset already assigned ${it.src}`);
        continue;
      }
      used.add(it.src);
      members.push(it);
    }
    if (members.length === 0) {
      warnings.push(`Project ${rec.id}: no matching catalog assets`);
      continue;
    }
    const ordered = orderAssets(rec, members, rec.section);
    resolved.push({
      id: rec.id,
      title: rec.title,
      section: rec.section,
      releaseDate: rec.releaseDate ?? null,
      datePrecision: rec.datePrecision ?? null,
      dateSource: rec.dateSource ?? null,
      provisional: Boolean(rec.provisional),
      coverAsset: rec.coverAsset ?? null,
      projectOrder: rec.projectOrder ?? null,
      lockOrder: Boolean(rec.lockOrder),
      notes: rec.notes ?? null,
      assets: ordered.map((i) => i.src),
      items: ordered,
    });
  }

  const leftovers = items.filter((i) => !used.has(i.src));
  const leftoverBySection = new Map();
  for (const it of leftovers) {
    const k = it.sectionKey || "editorial";
    if (!leftoverBySection.has(k)) leftoverBySection.set(k, []);
    leftoverBySection.get(k).push(it);
  }
  for (const [section, list] of leftoverBySection) {
    warnings.push(
      `Auto-provisional ${section}: ${list.length} catalog asset(s) not in work-projects.json`
    );
    const ordered = VIDEO_FIRST_SECTIONS.has(section)
      ? [...list.filter((i) => i.kind === "video"), ...list.filter((i) => i.kind !== "video")]
      : list;
    resolved.push({
      id: `${section}-catalog-new`,
      title: "Untitled stills",
      section,
      releaseDate: null,
      datePrecision: null,
      dateSource: null,
      provisional: true,
      coverAsset: ordered[0]?.src ?? null,
      projectOrder: null,
      lockOrder: false,
      notes: "Automatically grouped because these assets were not listed in work-projects.json.",
      assets: ordered.map((i) => i.src),
      items: ordered,
    });
  }

  const bySection = new Map();
  for (const p of resolved) {
    if (!bySection.has(p.section)) bySection.set(p.section, []);
    bySection.get(p.section).push(p);
  }
  const orderedProjects = [];
  for (const [section, list] of bySection) {
    list.sort((a, b) => compareProjects(a, b, section, indexes.bySrc));
    orderedProjects.push(...list);
  }

  const flat = [];
  for (const p of orderedProjects) {
    for (const it of p.items) {
      flat.push({ ...it, projectId: p.id });
    }
  }

  return { items: flat, projects: orderedProjects, warnings };
}

export { VIDEO_FIRST_SECTIONS, dateSortValue };
