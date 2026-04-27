import { interiorMainTopClass } from "@/lib/interior-layout";

/**
 * Shared `<main>` for all interior pages (see `lib/interior-layout.ts` for `interiorMainTopClass`).
 * Homepage (`/`) is outside this group.
 */
export default function InteriorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className={interiorMainTopClass}>{children}</main>;
}
