import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageStill } from "@/components/InfoPageStill";
import { FadeIn } from "@/components/FadeIn";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Info",
  description:
    "Stylist and costume designer. Press, contact, and Instagram.",
};

const PRESS_LINKS: { publication: string; title: string; href: string }[] = [];

export default function InfoPage() {
  return (
    <>
      <div
        className="mx-auto max-w-6xl px-5 sm:px-6 md:px-10"
        id="info"
      >
        <FadeIn>
          <h1 className="font-serif text-2xl font-light text-charcoal/88 sm:text-3xl">Info</h1>

          <div
            className="relative z-0 mt-10 min-h-[min(70vh,36rem)] sm:mt-12 sm:min-h-[min(65vh,38rem)] md:min-h-[min(62vh,40rem)]"
          >
            <div
              className="relative z-10 w-full max-w-xl space-y-6 pl-0 pr-[min(9.25rem,32vw)] text-left font-sans text-[0.92rem] leading-[1.85] text-charcoal/55 sm:space-y-7 sm:pr-40 sm:text-[0.95rem] sm:leading-[1.9] md:pr-44 lg:pr-48"
            >
              <p>
                Jaclyn Fleurant is a stylist and costume designer with a clear
                and intentional point of view. Her work is guided by both instinct and precision,
                shaped by a sensitivity to silhouette, texture, and mood. Clothing is never
                incidental. It is used to define character, build identity, and create a sense of
                presence within an image.
              </p>
              <p>
                She studied Design and Merchandising at Drexel University and later Fashion
                Marketing and Business at the London College of Fashion, developing a foundation
                that blends both creative and structural thinking. Early time spent within the
                studio of Marc Jacobs in New York refined her eye for proportion and detail,
                grounding her approach in the craft of construction as much as in image making.
              </p>
              <p>
                Jaclyn works across editorial, advertising, performance, and red carpet. Her work
                reflects a balance of control and intuition, with an emphasis on clarity and
                restraint. The result is imagery that feels considered, elevated, and quietly
                confident.
              </p>
            </div>
            <div
              className="pointer-events-none absolute inset-0 z-0 flex items-center justify-end"
              aria-hidden
            >
              <InfoPageStill />
            </div>
          </div>

          <div className="mt-12 max-w-md sm:mt-16">
            <h2 className="sr-only">Contact</h2>
            <ul className="m-0 list-none space-y-4 p-0 sm:space-y-5">
              <li>
                <a
                  href="mailto:jaclyn.fleurant@gmail.com"
                  className="inline-block w-fit max-w-full font-sans text-sm text-charcoal/50 transition-opacity duration-1000 hover:opacity-70 focus:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
                >
                  jaclyn.fleurant@gmail.com
                </a>
              </li>
              <li>
                <Link
                  href="https://www.instagram.com/jacfleurant/"
                  className="inline-block w-fit font-sans text-sm text-charcoal/38 transition-opacity duration-1000 hover:opacity-70 focus:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  instagram.com/jacfleurant
                </Link>
              </li>
            </ul>
          </div>

          <section className="mt-20 max-w-md sm:mt-24" aria-label="Press and articles">
            <h2 className="mb-4 font-sans text-[0.6rem] font-normal tracking-[0.14em] text-charcoal/32 sm:mb-5">
              Press
            </h2>
            {PRESS_LINKS.length > 0 ? (
              <ul className="m-0 list-none space-y-3.5 p-0 sm:space-y-4">
                {PRESS_LINKS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-sans text-[0.7rem] leading-relaxed no-underline transition-colors duration-500 text-charcoal/38 hover:text-charcoal/65 focus:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
                    >
                      <span className="text-charcoal/32">{item.publication}</span>
                      <span className="text-charcoal/22"> — </span>
                      <span>&ldquo;{item.title}&rdquo;</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </FadeIn>
      </div>
      <SiteFooter />
    </>
  );
}
