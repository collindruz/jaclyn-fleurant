import type { Metadata } from "next";
import { WorkExperience } from "@/components/work/WorkExperience";
import { SiteFooter } from "@/components/SiteFooter";
import { interiorMainTopClass } from "@/lib/site-nav";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Photography and motion, organized as a small editorial color palette.",
};

export default function WorkPage() {
  return (
    <>
      <main className={`${interiorMainTopClass} pb-10 sm:pb-10`}>
        <h1 className="sr-only">Work</h1>
        <WorkExperience />
      </main>
      <SiteFooter />
    </>
  );
}
