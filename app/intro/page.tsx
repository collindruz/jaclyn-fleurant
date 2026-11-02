import type { Metadata } from "next";
import { HomeExhibit } from "@/components/HomeExhibit";

export const metadata: Metadata = {
  title: { absolute: "JACLYN FLEURANT" },
  description: "Stylist and creative director — styling, on-set, and live moments.",
};

export default function IntroPage() {
  return (
    <div className="relative min-h-[100dvh] w-full">
      <HomeExhibit />
    </div>
  );
}
