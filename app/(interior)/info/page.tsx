import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/FadeIn";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Info",
  description:
    "JACLYN FLEURANT — stylist and creative director, New York. Press, contact, and Instagram.",
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

          <div className="mt-10 max-w-md space-y-5 font-sans text-[0.9rem] leading-[1.75] text-charcoal/55 sm:mt-12 sm:text-[0.92rem] sm:leading-8">
            <p>
              JACLYN FLEURANT is a New York based stylist and creative director, working across
              fashion, film, and live moments.
            </p>
          </div>

          <div className="mt-12 max-w-md sm:mt-16">
            <h2 className="sr-only">Contact</h2>
            <p className="font-sans text-[0.85rem] leading-7 text-charcoal/45 sm:leading-8 md:text-[0.9rem]">
              A few sentences in the email is how I get context — I read the note before anything
              else. Decks and PDFs are fine after that, if the project needs them. If the fit is
              wrong, I’ll say so; if it’s not, we’ll go deeper.
            </p>
            <ul className="mt-8 list-none space-y-4 p-0 sm:mt-10 sm:space-y-5">
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
