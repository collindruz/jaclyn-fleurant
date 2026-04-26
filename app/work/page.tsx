import type { Metadata } from "next";
import { WorkExperience } from "@/components/work/WorkExperience";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Photography and motion, organized as a small editorial color palette.",
};

export default function WorkPage() {
  return (
    <>
      <main className="pb-8 pt-20 sm:pb-10 sm:pt-24">
        <h1 className="sr-only">Work</h1>
        <WorkExperience />
      </main>
      <SiteFooter />
    </>
  );
}
