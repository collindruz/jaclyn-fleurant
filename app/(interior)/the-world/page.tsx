import type { Metadata } from "next";
import { DraggableWorld } from "@/components/DraggableWorld";
import { FadeIn } from "@/components/FadeIn";
import { SiteFooter } from "@/components/SiteFooter";
import { copy, getWorldStillsFromColorGroups } from "@/lib/placeholders";

export const metadata: Metadata = {
  title: "World",
  description: "Selected stills and visual references.",
};

export default function TheWorldPage() {
  const stills = getWorldStillsFromColorGroups();

  return (
    <>
      <section className="px-5 sm:px-6 md:px-10">
        <div className="mx-auto max-w-3xl">
          <FadeIn slow>
            <h1 className="font-serif text-xl font-light leading-relaxed text-charcoal/70 sm:text-2xl md:text-[1.7rem] md:leading-snug">
              {copy.worldIntro}
            </h1>
          </FadeIn>
        </div>
      </section>

      <section className="mt-20 px-0 pb-4 sm:mt-24 md:mt-28">
        <DraggableWorld srcs={stills} />
      </section>

      <div className="h-20 sm:h-24 md:h-32" aria-hidden />
      <SiteFooter />
    </>
  );
}
