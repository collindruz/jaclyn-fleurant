import type { Metadata } from "next";
import { workSections } from "@/lib/placeholders";
import { WORK_COLOR_ORDER, WORK_SECTION_ORDER } from "@/lib/work-types";
import { DebugImagesClient } from "./DebugImagesClient";

export const metadata: Metadata = {
  title: "Debug images",
  robots: { index: false, follow: false },
};

function buildRows() {
  const rows: {
    src: string;
    kind: "image" | "video";
    context: string;
  }[] = [];
  for (const section of WORK_SECTION_ORDER) {
    for (const color of WORK_COLOR_ORDER) {
      const items = workSections[section.key][color.key];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        rows.push({
          src: item.src,
          kind: item.kind,
          context: `${section.label} · ${color.label} · #${i + 1}`,
        });
      }
    }
  }
  return rows;
}

export default function DebugImagesPage() {
  const rows = buildRows();
  return <DebugImagesClient rows={rows} />;
}
