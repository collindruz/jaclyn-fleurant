/** Main site index — shared by homepage + global header. */
export const SITE_NAV = [
  { href: "/the-world", label: "World" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "Read" },
  { href: "/contact", label: "Write" },
] as const;

/**
 * Top padding for interior pages below the fixed global header
 * (title + mobile horizontal / desktop row nav). Tuned 140–180px on small viewports.
 */
export const interiorMainTopClass = "pt-[160px] sm:pt-24 md:pt-32";
