import type { Metadata } from "next";
import { FadeIn } from "@/components/FadeIn";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Read",
  description: "JACLYN FLEURANT — stylist and creative director, New York.",
};

/**
 * Trade press / articles. Add only verified URLs and copy.
 *
 * // Example (uncomment and replace with real links):
 * // { publication: "Vogue", title: "Title of article", href: "https://…" },
 * // { publication: "Billboard", title: "Title of article", href: "https://…" },
 * // { publication: "i-D", title: "Title of article", href: "https://…" },
 */
const PRESS_LINKS: { publication: string; title: string; href: string }[] = [];

export default function AboutPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-10">
        <FadeIn>
          <h1 className="sr-only">Read</h1>
          <div className="max-w-md space-y-5 font-sans text-[0.9rem] leading-[1.75] text-charcoal/55 sm:text-[0.92rem] sm:leading-8">
            <p>
              JACLYN FLEURANT is a New York based stylist and creative director, working across
              fashion, film, and live moments.
            </p>
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
