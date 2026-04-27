/** Main site index — shared by homepage + global header. Read + Write are combined at `/info`. */
export const SITE_NAV = [
  { href: "/the-world", label: "World" },
  { href: "/work", label: "Work" },
  { href: "/info", label: "Info" },
] as const;
