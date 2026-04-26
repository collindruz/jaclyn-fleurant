import { HeroImage } from "@/components/HeroImage";
import { FabricHeroVeil, LinenWeave } from "@/components/FabricHeroVeil";
import { HomeExhibit } from "@/components/HomeExhibit";
import { images } from "@/lib/placeholders";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "JACLYN FLEURANT" },
  description: "Stylist and creative director, New York.",
};

export default function Home() {
  return (
    <main id="main">
      <section className="relative min-h-[100dvh]">
        <HeroImage src={images.hero} alt="" priority />
        <FabricHeroVeil />
        <LinenWeave />
        <HomeExhibit />
      </section>
    </main>
  );
}
