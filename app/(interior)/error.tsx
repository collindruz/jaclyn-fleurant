"use client";

export default function InteriorError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="px-8 py-20">
      <p className="font-serif text-[1.6rem] font-light text-charcoal/70">
        This page hit a snag.
      </p>
      <p className="mt-3 max-w-md font-sans text-[0.8rem] leading-relaxed text-charcoal/45">
        The rest of the site is still available. Try this page again, or go
        back to Work.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full bg-charcoal px-5 py-2 font-sans text-[0.72rem] uppercase tracking-[0.16em] text-bone"
          onClick={() => reset()}
        >
          Try again
        </button>
        <a
          href="/work"
          className="rounded-full border border-charcoal/15 px-5 py-2 font-sans text-[0.72rem] uppercase tracking-[0.16em] text-charcoal/70"
        >
          Work
        </a>
      </div>
    </div>
  );
}
