import type { Metadata } from "next";
import { WorkExperience } from "@/components/work/WorkExperience";
import { SiteFooter } from "@/components/SiteFooter";
import { getLiveWorkProjectSections } from "@/lib/work-layout-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Photography and motion, organized as a small editorial color palette.",
};

export default async function WorkPage() {
  const sections = await getLiveWorkProjectSections();
  return (
    <>
      <h1 className="sr-only">Work</h1>
      <div className="pb-10 sm:pb-10">
        <WorkExperience sections={sections} />
      </div>
      <SiteFooter />
    </>
  );
}
