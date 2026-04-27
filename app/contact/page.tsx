import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/FadeIn";
import { SiteFooter } from "@/components/SiteFooter";
import { interiorMainTopClass } from "@/lib/site-nav";

export const metadata: Metadata = {
  title: "Write",
  description: "A real note in the email first. The rest can follow if it’s a fit.",
};

export default function ContactPage() {
  return (
    <>
      <main className={interiorMainTopClass} id="write">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-10">
          <FadeIn>
            <div className="max-w-md">
              <h1 className="font-serif text-2xl font-light text-charcoal/88 sm:text-3xl">Write</h1>
              <p className="mt-8 font-sans text-[0.85rem] leading-7 text-charcoal/45 sm:mt-10 sm:leading-8 md:text-[0.9rem]">
                A few sentences in the email is how I get context — I read the note before anything
                else. Decks and PDFs are fine after that, if the project needs them. If the fit is
                wrong, I’ll say so; if it’s not, we’ll go deeper.
              </p>
              <ul className="mt-12 list-none space-y-4 p-0 sm:mt-14 sm:space-y-5">
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
          </FadeIn>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
