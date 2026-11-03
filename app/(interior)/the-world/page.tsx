import type { Metadata } from "next";
import { DraggableWorld } from "@/components/DraggableWorld";
import { getWorldStillsFromCatalog } from "@/lib/placeholders";

export const metadata: Metadata = {
  title: "World",
  description: "Stills and visual references.",
};

export default function TheWorldPage() {
  const stills = getWorldStillsFromCatalog();

  return (
    <section className="relative h-full min-h-0 w-full overflow-hidden overscroll-none">
      <DraggableWorld stills={stills} />
    </section>
  );
}
