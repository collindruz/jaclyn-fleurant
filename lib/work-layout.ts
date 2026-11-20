/**
 * Optional Work layout overlay from `/admin`.
 * When `enabled` is false or `projects` is empty, the catalog is used as-is.
 * Filenames are never renamed; hide only adds basenames to `hidden`.
 */
import { WORK_CATALOG, WORK_CATALOG_EXCLUSIONS, WORK_PROJECTS } from "./work-catalog";
import { EXCLUDE_FILENAMES } from "./work-curation";
import type { WorkItem, WorkProjectGroup, WorkSectionKey } from "./work-types";
import { WORK_SECTION_ORDER } from "./work-types";
import layoutJson from "./work-layout.json";

export type WorkProjectSections = Record<WorkSectionKey, WorkProjectGroup[]>;

export type WorkLayoutProject = {
  id: string;
  title: string;
  sectionKey: WorkSectionKey;
  assets: string[];
};

export type WorkLayoutFile = {
  version: 1;
  enabled: boolean;
  notes?: string;
  /** Basenames only (e.g. site-048.jpg). Files stay on disk. */
  hidden: string[];
  projects: WorkLayoutProject[];
};

export type AdminPhoto = {
  src: string;
  filename: string;
  kind: "image" | "video";
  poster?: string;
  width: number;
  height: number;
  projectId: string;
  sectionKey: WorkSectionKey;
};

export type AdminProject = {
  id: string;
  title: string;
  sectionKey: WorkSectionKey;
  assets: string[];
};

export type AdminInventory = {
  photos: AdminPhoto[];
  projects: AdminProject[];
  hidden: string[];
  baselineHidden: string[];
};

const SECTION_KEYS = new Set<string>(WORK_SECTION_ORDER.map((s) => s.key));

export function workAssetBasename(src: string): string {
  const clean = (src.split("?")[0] ?? src).replace(/\\/g, "/");
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    /* keep */
  }
  const i = decoded.lastIndexOf("/");
  return i === -1 ? decoded : decoded.slice(i + 1);
}

function projectsInSectionOrder(projects: AdminProject[]): AdminProject[] {
  const out: AdminProject[] = [];
  const used = new Set<string>();
  for (const section of WORK_SECTION_ORDER) {
    for (const project of projects) {
      if (project.sectionKey !== section.key || used.has(project.id)) continue;
      used.add(project.id);
      out.push(project);
    }
  }
  for (const project of projects) {
    if (used.has(project.id)) continue;
    used.add(project.id);
    out.push(project);
  }
  return out;
}

function ensureAllSectionProjects(projects: AdminProject[]): AdminProject[] {
  const next = [...projects];
  for (const section of WORK_SECTION_ORDER) {
    if (next.some((p) => p.sectionKey === section.key)) continue;
    next.push({
      id: `${section.key}-unassigned`,
      title: section.label,
      sectionKey: section.key,
      assets: [],
    });
  }
  return projectsInSectionOrder(next);
}

function emptySections(): WorkProjectSections {
  const out = {} as WorkProjectSections;
  for (const section of WORK_SECTION_ORDER) {
    out[section.key] = [];
  }
  return out;
}

/** Always has an array for every key in WORK_SECTION_ORDER. */
export function normalizeWorkProjectSections(
  input: Partial<WorkProjectSections> | null | undefined
): WorkProjectSections {
  const out = emptySections();
  if (!input) return out;
  for (const section of WORK_SECTION_ORDER) {
    const groups = input[section.key];
    out[section.key] = Array.isArray(groups) ? groups : [];
  }
  return out;
}

function catalogBySrc(): Map<string, WorkItem> {
  const bySrc = new Map<string, WorkItem>();
  for (const item of WORK_CATALOG) {
    if (!bySrc.has(item.src)) bySrc.set(item.src, item);
  }
  for (const ex of WORK_CATALOG_EXCLUSIONS) {
    const src = `/images/work/${ex.file}`;
    if (!bySrc.has(src)) {
      bySrc.set(src, {
        kind: "image",
        src,
        width: 4,
        height: 5,
      });
    }
  }
  return bySrc;
}

const PROJECT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/;
const HIDDEN_NAME_RE = /^[^\\/]+$/;

function isSafeAssetSrc(src: string): boolean {
  if (src.includes("..") || src.includes("\\") || src.includes("\0")) return false;
  if (src.length > 800) return false;
  if (src.startsWith("/images/work/")) return true;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "youtube-nocookie.com" ||
      host === "vimeo.com"
    );
  } catch {
    return false;
  }
}
const MAX_PROJECTS = 400;
const MAX_ASSETS_PER_PROJECT = 400;
const MAX_HIDDEN = 2000;
const MAX_TITLE = 200;

export function isWorkLayoutActive(
  layout: WorkLayoutFile | null | undefined
): layout is WorkLayoutFile {
  return Boolean(
    layout?.enabled &&
      Array.isArray(layout.projects) &&
      layout.projects.length > 0 &&
      Array.isArray(layout.hidden)
  );
}

export function parseWorkLayout(
  input: unknown
): { ok: true; layout: WorkLayoutFile } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Layout must be an object." };
  }
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1) {
    return { ok: false, error: "Layout version must be 1." };
  }
  if (!Array.isArray(raw.hidden)) {
    return { ok: false, error: "Layout hidden must be an array of filenames." };
  }
  if (!Array.isArray(raw.projects)) {
    return { ok: false, error: "Layout projects must be an array." };
  }
  if (raw.projects.length > MAX_PROJECTS) {
    return { ok: false, error: "Too many projects." };
  }
  if (raw.hidden.length > MAX_HIDDEN) {
    return { ok: false, error: "Too many hidden filenames." };
  }

  const hidden: string[] = [];
  const hiddenSeen = new Set<string>();
  for (const name of raw.hidden) {
    if (typeof name !== "string") {
      return { ok: false, error: "Hidden entries must be filenames." };
    }
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes("..") || !HIDDEN_NAME_RE.test(trimmed)) {
      return { ok: false, error: `Invalid hidden filename: ${name}` };
    }
    if (trimmed.length > 255) {
      return { ok: false, error: "Hidden filename is too long." };
    }
    if (hiddenSeen.has(trimmed)) continue;
    hiddenSeen.add(trimmed);
    hidden.push(trimmed);
  }

  const projects: WorkLayoutProject[] = [];
  const projectIds = new Set<string>();
  for (const rec of raw.projects) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
      return { ok: false, error: "Each project must be an object." };
    }
    const p = rec as Record<string, unknown>;
    if (typeof p.id !== "string" || !PROJECT_ID_RE.test(p.id)) {
      return { ok: false, error: "Invalid project id." };
    }
    if (projectIds.has(p.id)) {
      return { ok: false, error: `Duplicate project id: ${p.id}` };
    }
    projectIds.add(p.id);
    if (typeof p.sectionKey !== "string" || !SECTION_KEYS.has(p.sectionKey)) {
      return { ok: false, error: `Unknown category for ${p.id}.` };
    }
    if (typeof p.title !== "string" || p.title.length > MAX_TITLE) {
      return { ok: false, error: `Invalid title for ${p.id}.` };
    }
    if (!Array.isArray(p.assets) || p.assets.length > MAX_ASSETS_PER_PROJECT) {
      return { ok: false, error: `Invalid assets for ${p.id}.` };
    }
    const assets: string[] = [];
    const seenSrc = new Set<string>();
    for (const src of p.assets) {
      if (typeof src !== "string") {
        return { ok: false, error: `Invalid asset path in ${p.id}.` };
      }
      if (!isSafeAssetSrc(src)) {
        return { ok: false, error: `Blocked asset path in ${p.id}.` };
      }
      if (seenSrc.has(src)) continue;
      seenSrc.add(src);
      assets.push(src);
    }
    projects.push({
      id: p.id,
      title: p.title,
      sectionKey: p.sectionKey as WorkSectionKey,
      assets,
    });
  }

  const notes =
    typeof raw.notes === "string" ? raw.notes.slice(0, 500) : undefined;

  return {
    ok: true,
    layout: {
      version: 1,
      enabled: true,
      notes,
      hidden,
      projects,
    },
  };
}

export function applyWorkLayout(
  base: WorkProjectSections,
  layout: WorkLayoutFile | null | undefined
): WorkProjectSections {
  const safeBase = normalizeWorkProjectSections(base);
  if (!isWorkLayoutActive(layout)) return safeBase;

  try {
  const bySrc = catalogBySrc();
  for (const section of WORK_SECTION_ORDER) {
    for (const group of safeBase[section.key]) {
      for (const item of group.items ?? []) {
        if (!bySrc.has(item.src)) bySrc.set(item.src, item);
      }
    }
  }

  const hidden = new Set(
    (Array.isArray(layout.hidden) ? layout.hidden : [])
      .map((f) => f.trim())
      .filter(Boolean)
  );
  const titleById = new Map<string, string>();
  const provisionalById = new Map<string, boolean | undefined>();
  for (const project of WORK_PROJECTS) {
    titleById.set(project.id, project.title);
    provisionalById.set(project.id, project.provisional);
  }
  for (const section of WORK_SECTION_ORDER) {
    for (const group of safeBase[section.key]) {
      titleById.set(group.id, group.title);
      provisionalById.set(group.id, group.provisional);
    }
  }

  const out = emptySections();
  const used = new Set<string>();
  for (const rec of layout.projects) {
    if (!SECTION_KEYS.has(rec.sectionKey)) continue;
    const items: WorkItem[] = [];
    const assetList = Array.isArray(rec.assets) ? rec.assets : [];
    for (const src of assetList) {
      const item = bySrc.get(src);
      if (!item || used.has(item.src)) continue;
      if (hidden.has(workAssetBasename(item.src))) continue;
      used.add(item.src);
      items.push({
        ...item,
        sectionKey: rec.sectionKey,
        projectId: rec.id,
      });
    }
    if (items.length === 0) continue;
    out[rec.sectionKey].push({
      id: rec.id,
      title: rec.title || titleById.get(rec.id) || "Untitled",
      sectionKey: rec.sectionKey,
      provisional: provisionalById.get(rec.id),
      items,
    });
  }
  return normalizeWorkProjectSections(out);
  } catch {
    return safeBase;
  }
}

export function readWorkLayoutFile(): WorkLayoutFile {
  return layoutJson as WorkLayoutFile;
}

export function getAdminInventory(
  layoutOverride?: WorkLayoutFile | null
): AdminInventory {
  const bySrc = catalogBySrc();
  const hiddenSet = new Set(
    [...EXCLUDE_FILENAMES].map((f) => f.trim()).filter(Boolean)
  );
  const photos: AdminPhoto[] = [];
  const seen = new Set<string>();
  const projects: AdminProject[] = [];

  for (const project of WORK_PROJECTS) {
    const assets: string[] = [];
    for (const src of project.assets) {
      const item = bySrc.get(src);
      if (!item || seen.has(item.src)) continue;
      seen.add(item.src);
      const filename = workAssetBasename(item.src);
      photos.push({
        src: item.src,
        filename,
        kind: item.kind,
        poster: item.poster,
        width: item.width && item.width > 0 ? item.width : 4,
        height: item.height && item.height > 0 ? item.height : 5,
        projectId: project.id,
        sectionKey: project.sectionKey,
      });
      assets.push(item.src);
    }
    projects.push({
      id: project.id,
      title: project.title,
      sectionKey: project.sectionKey,
      assets,
    });
  }

  for (const [src, item] of bySrc) {
    if (seen.has(src)) continue;
    const filename = workAssetBasename(src);
    const sectionKey = (item.sectionKey && SECTION_KEYS.has(item.sectionKey)
      ? item.sectionKey
      : "editorial") as WorkSectionKey;
    photos.push({
      src,
      filename,
      kind: item.kind,
      poster: item.poster,
      width: item.width && item.width > 0 ? item.width : 4,
      height: item.height && item.height > 0 ? item.height : 5,
      projectId: item.projectId || `${sectionKey}-unassigned`,
      sectionKey,
    });
    seen.add(src);
    if (!hiddenSet.has(filename)) hiddenSet.add(filename);
  }

  const layout = layoutOverride ?? (layoutJson as WorkLayoutFile);
  if (isWorkLayoutActive(layout)) {
    try {
      const layoutHidden = new Set(
        (Array.isArray(layout.hidden) ? layout.hidden : [])
          .map((f) => f.trim())
          .filter(Boolean)
      );
      return {
        photos,
        projects: ensureAllSectionProjects(
          layout.projects.map((p) => ({
            id: p.id,
            title: p.title,
            sectionKey: p.sectionKey,
            assets: Array.isArray(p.assets) ? [...p.assets] : [],
          }))
        ),
        hidden: [...layoutHidden],
        baselineHidden: [...EXCLUDE_FILENAMES],
      };
    } catch {
      /* fall through to catalog inventory */
    }
  }

  return {
    photos,
    projects: ensureAllSectionProjects(projects),
    hidden: [...hiddenSet],
    baselineHidden: [...EXCLUDE_FILENAMES],
  };
}

export function layoutFromEditorState(input: {
  projects: AdminProject[];
  hidden: string[];
}): WorkLayoutFile {
  return {
    version: 1,
    enabled: true,
    notes:
      "Saved from /admin. Work uses this overlay for category, order, and hidden filenames. Files are not renamed or deleted.",
    hidden: [...input.hidden],
    projects: projectsInSectionOrder(
      ensureAllSectionProjects(input.projects)
    ).map((p) => ({
      id: p.id,
      title: p.title,
      sectionKey: p.sectionKey,
      assets: Array.isArray(p.assets) ? [...p.assets] : [],
    })),
  };
}

