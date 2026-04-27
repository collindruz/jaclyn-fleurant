import type { Metadata } from "next";
import { DraggableWorld } from "@/components/DraggableWorld";
import { FadeIn } from "@/components/FadeIn";
import { SiteFooter } from "@/components/SiteFooter";
import { getWorldStillsFromColorGroups } from "@/lib/placeholders";

export const metadata: Metadata = {
  title: "World",
  description: "Selected stills and visual references.",
};

export default function TheWorldPage() {
  const stills = getWorldStillsFromColorGroups();

  return (
    <>
      <section className="mt-20 px-0 pb-4 sm:mt-24 md:mt-28">
        <DraggableWorld srcs={stills} />
      </section>

      <div className="h-20 sm:h-24 md:h-32" aria-hidden />
      <SiteFooter />
    </>
  );
}
