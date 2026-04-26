export type WorkMediaKind = "image" | "video";

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

/** Virtual work sections — all assets stay under /images/work/site-pull; assignment is in data. */
export const WORK_SECTION_ORDER = [
  { key: "editorial" as const, label: "Editorial" },
  { key: "redCarpet" as const, label: "Red Carpet" },
  { key: "advertising" as const, label: "Advertising" },
  { key: "costumeDesign" as const, label: "Costume Design" },
] as const;

export type WorkSectionKey = (typeof WORK_SECTION_ORDER)[number]["key"];

/** One image or video in the archive — no case study copy; optional short caption (credit, title, year). */
export type WorkItem = {
  kind: WorkMediaKind;
  src: string;
  /** Optional short line; never a narrative block — titles, names, or dates only. */
  caption?: string;
};
