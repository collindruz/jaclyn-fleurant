import type { Metadata } from "next";
import { HomeExhibit } from "@/components/HomeExhibit";
import { getHomeFrameSlides } from "@/lib/home-frame-slides";

export const metadata: Metadata = {
  title: { absolute: "JACLYN FLEURANT" },
  description: "Stylist and creative director — styling, on-set, and live moments.",
};

export default function IntroPage() {
  const slides = getHomeFrameSlides();
  return (
    <div className="relative min-h-[100dvh] w-full">
      <HomeExhibit slides={slides} />
    </div>
  );
}
