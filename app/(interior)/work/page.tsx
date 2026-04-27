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
      <h1 className="sr-only">Work</h1>
      <div className="pb-10 sm:pb-10">
        <WorkExperience />
      </div>
      <SiteFooter />
    </>
  );
}
