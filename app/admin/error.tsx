"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh bg-bone px-8 py-20 text-charcoal">
      <p className="font-serif text-[1.6rem] font-light text-charcoal/70">
        The editor hit a snag.
      </p>
      <p className="mt-3 max-w-md font-sans text-[0.8rem] leading-relaxed text-charcoal/45">
        Work on the public site is unchanged. Reload the editor, or open Work
        to confirm the live layout.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full bg-charcoal px-5 py-2 font-sans text-[0.72rem] uppercase tracking-[0.16em] text-bone"
          onClick={() => reset()}
        >
          Reload editor
        </button>
        <a
          href="/work"
          className="rounded-full border border-charcoal/15 px-5 py-2 font-sans text-[0.72rem] uppercase tracking-[0.16em] text-charcoal/70"
        >
          Open Work
        </a>
      </div>
    </div>
  );
}
