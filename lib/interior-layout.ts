/**
 * Shared `<main>` top spacing for all routes under `app/(interior)/` (not the homepage).
 * Use only here — do not add per-page `pt-*` for header clearance; no right padding, full width.
 */
export const interiorMainTopClass =
  "box-border w-full min-w-0 " +
  "pt-[calc(200px+env(safe-area-inset-top,0px))] " +
  "md:pt-[calc(140px+env(safe-area-inset-top,0px))]";
