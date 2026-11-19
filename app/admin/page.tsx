import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminInventory } from "@/lib/work-layout";
import { loadWorkLayoutFromDisk } from "@/lib/work-layout-server";
import { AdminEditor } from "./AdminEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Portfolio editor",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const savedLayout = await loadWorkLayoutFromDisk();
  const inventory = getAdminInventory(savedLayout);
  return <AdminEditor inventory={inventory} />;
}
