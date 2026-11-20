"use client";

import { useEffect, useState } from "react";
import { WorkExperience } from "@/components/work/WorkExperience";
import type { WorkProjectSections } from "@/lib/work-layout";

/**
 * Work strips are client-only. Hydrating the gallery against SSR HTML is what
 * pops the Next.js overlay and makes the site look crashed after /admin saves.
 */
export function WorkGallery({ sections }: { sections: WorkProjectSections }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-[70vh]" aria-hidden />;
  }

  return <WorkExperience sections={sections} />;
}
