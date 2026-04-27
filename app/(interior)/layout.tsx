import { interiorMainClass } from "@/lib/interior-layout";

/**
 * Shared `<main>` for all interior pages. Header clearance comes from `Navigation` being in flow
 * (sticky, not fixed). See `lib/interior-layout.ts`.
 */
export default function InteriorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className={interiorMainClass}>{children}</main>;
}
