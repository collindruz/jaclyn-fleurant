/**
 * Shared `<main>` for all routes under `app/(interior)/`.
 * The global `Navigation` is `sticky` (not `fixed`), so it reserves height in the document flow —
 * do not add per-page `pt-*` to clear a floating header. Full width, no right gutter.
 */
export const interiorMainClass =
  "box-border w-full min-w-0 min-h-0";

/** @deprecated use `interiorMainClass` — padding was for `fixed` nav; no longer used. */
export const interiorMainTopClass = interiorMainClass;
