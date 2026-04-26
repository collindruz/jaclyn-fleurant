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

/** One image or video in the archive — no case study copy; optional short caption (credit, title, year). */
export type WorkItem = {
  kind: WorkMediaKind;
  src: string;
  /** Optional short line; never a narrative block — titles, names, or dates only. */
  caption?: string;
};
