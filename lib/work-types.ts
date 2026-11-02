export type WorkMediaKind = "image" | "video";

const VIDEO_EXT = new Set([".mp4", ".webm", ".m4v", ".mov"]);

export function isWorkVideoFilename(name: string): boolean {
  const i = name.lastIndexOf(".");
  if (i === -1) return false;
  return VIDEO_EXT.has(name.slice(i).toLowerCase());
}

export function workMediaKindFromFilename(name: string): WorkMediaKind {
  return isWorkVideoFilename(name) ? "video" : "image";
}

/**
 * Work archive — one editorial palette strip per row (order = top to bottom).
 * Curated fashion feel: six groups only.
 */
export const WORK_COLOR_ORDER = [
  { key: "black" as const, label: "Black" },
  { key: "white" as const, label: "White" },
  { key: "neutral" as const, label: "Neutral" },
  { key: "warm" as const, label: "Warm" },
  { key: "cool" as const, label: "Cool" },
  { key: "vivid" as const, label: "Vivid" },
] as const;

export type WorkColorKey = (typeof WORK_COLOR_ORDER)[number]["key"];

/** Work sections — local files live in `public/images/work/{editorial,costume-design,…}`. */
export const WORK_SECTION_ORDER = [
  { key: "editorial" as const, label: "Editorial" },
  { key: "costumeDesign" as const, label: "Costume Design" },
  { key: "advertising" as const, label: "Advertising" },
  { key: "musicVideos" as const, label: "Music Videos" },
  { key: "events" as const, label: "Events" },
] as const;

export type WorkSectionKey = (typeof WORK_SECTION_ORDER)[number]["key"];

export type WorkExternalProvider = "youtube" | "vimeo";

export type WorkExternalVideo = {
  provider: WorkExternalProvider;
  id: string;
  watchUrl: string;
  embedUrl: string | null;
  embeddable: boolean;
  title: string;
};

export type WorkDatePrecision = "day" | "month" | "year";

/** One image or video in the archive — no case study copy; optional short caption (credit, title, year). */
export type WorkItem = {
  kind: WorkMediaKind;
  src: string;
  /** Optional short line; never a narrative block — titles, names, or dates only. */
  caption?: string;
  width?: number;
  height?: number;
  poster?: string;
  colorKey?: WorkColorKey;
  sectionKey?: WorkSectionKey;
  projectId?: string;
  external?: WorkExternalVideo;
  /** Closed-tile poster pixel size (YouTube thumbs). Player uses width/height. */
  posterWidth?: number;
  posterHeight?: number;
};

/** Editable project row from `lib/work-projects.json` after catalog resolve. */
export type WorkProjectRecord = {
  id: string;
  title: string;
  sectionKey: WorkSectionKey;
  releaseDate: string | null;
  datePrecision: WorkDatePrecision | null;
  dateSource: string | null;
  provisional: boolean;
  assets: readonly string[];
  coverAsset?: string;
  projectOrder?: number;
  /** When true, `assets` / `coverAsset` order wins over video-first sorting. */
  lockOrder?: boolean;
  notes?: string;
};

export type WorkProjectGroup = {
  id: string;
  title: string;
  sectionKey: WorkSectionKey;
  provisional?: boolean;
  items: WorkItem[];
};
