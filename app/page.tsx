import type { Metadata } from "next";
import { WorkExperience } from "@/components/work/WorkExperience";
import { SiteFooter } from "@/components/SiteFooter";
import { interiorMainClass } from "@/lib/interior-layout";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Photography and motion, organized as a small editorial color palette.",
};

export default function HomePage() {
  return (
    <main className={interiorMainClass}>
      <h1 className="sr-only">Work</h1>
      <div className="pb-10 sm:pb-10">
        <WorkExperience />
      </div>
      <SiteFooter />
    </main>
  );
}
