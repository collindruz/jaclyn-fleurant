import type { Metadata } from "next";
import { workProjectSections } from "@/lib/placeholders";
import { WORK_SECTION_ORDER } from "@/lib/work-types";
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
    for (const project of workProjectSections[section.key]) {
      for (let i = 0; i < project.items.length; i++) {
        const item = project.items[i];
        rows.push({
          src: item.src,
          kind: item.kind,
          context: `${section.label} · ${project.title} · #${i + 1}`,
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
