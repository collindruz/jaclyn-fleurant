"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { getHomeFrameSlides, type HomeFrameSlide } from "@/lib/home-frame-slides";

/** Soft crossfade duration (ease-in-out; overlap reads as a gentle blend). */
const FADE_MS = 1400;
/** Time each slide is fully legible before the next crossfade. */
const HOLD_MS = 2500;

type Slide = HomeFrameSlide;

function SlideMedia({ slide }: { slide: Slide }) {
  return (
    <div className="absolute inset-0">
      <Image
        src={slide.src}
        alt=""
        fill
        className="object-contain object-center"
        sizes="(max-width: 640px) 40vw, 384px"
        quality={90}
        priority
        draggable={false}
      />
    </div>
  );
}

/** Borderless float: smaller on phone so it does not cover the centered name. */
const stillClass =
  "relative w-[min(6.25rem,36vw)] shrink-0 overflow-visible bg-transparent sm:w-[8.5rem] md:w-[10rem] lg:w-[11rem] xl:w-[12rem] xl:max-w-[12rem]";

function stillBoxStyle(slides: Slide[]) {
  const first = slides[0];
  const w = first?.width && first.width > 0 ? first.width : 4;
  const maxH = Math.max(
    ...slides.map((s) => (s.height / Math.max(s.width, 1)) * w),
    5
  );
  return { aspectRatio: `${w} / ${maxH}` };
}

/**
 * Crossfading stills. Timing: HOLD_MS / FADE_MS.
 */
function HomeStillsCrossfade({ slides }: { slides: Slide[] }) {
  const reduce = useReducedMotion();
  const n = slides.length;
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"rest" | "fading">("rest");
  const [snap, setSnap] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (n < 2 || reduce) return;
    const t = setInterval(() => {
      if (phaseRef.current === "rest") {
        setPhase("fading");
      }
    }, HOLD_MS);
    return () => clearInterval(t);
  }, [n, reduce]);

  useEffect(() => {
    if (!snap) return;
    const t = setTimeout(() => setSnap(false), 60);
    return () => clearTimeout(t);
  }, [snap]);

  if (n === 0) return null;

  if (n === 1 || reduce) {
    return (
      <div className={stillClass} style={stillBoxStyle(slides)}>
        <div className="absolute inset-0 z-[1]">
          <SlideMedia slide={slides[0]} />
        </div>
      </div>
    );
  }

  const next = (i + 1) % n;
  const oBack = phase === "fading" ? 0 : 1;
  const oFront = phase === "fading" ? 1 : 0;
  const dur = snap ? 0 : FADE_MS;

  const onBackEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "opacity" || phaseRef.current !== "fading") return;
    setI((j) => (j + 1) % n);
    setPhase("rest");
    setSnap(true);
  };

  const ease = "cubic-bezier(0.45, 0, 0.2, 1)";

  return (
    <div className={stillClass} style={stillBoxStyle(slides)}>
      <div
        className="absolute inset-0 z-[1] will-change-[opacity]"
        style={{
          opacity: oBack,
          transitionProperty: "opacity",
          transitionDuration: `${dur}ms`,
          transitionTimingFunction: ease,
        }}
        onTransitionEnd={onBackEnd}
      >
        <SlideMedia slide={slides[i]} />
      </div>
      <div
        className={`absolute inset-0 z-[2] will-change-[opacity] ${oFront < 0.05 ? "pointer-events-none" : ""}`}
        style={{
          opacity: oFront,
          transitionProperty: "opacity",
          transitionDuration: `${dur}ms`,
          transitionTimingFunction: ease,
        }}
      >
        <SlideMedia slide={slides[next]} />
      </div>
    </div>
  );
}

const linkFocus =
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[6px] focus-visible:outline-charcoal/25";

const workLinkClass =
  "block shrink-0 cursor-pointer no-underline outline-none [-webkit-tap-highlight-color:transparent] touch-manipulation " +
  linkFocus;

const nameLinkClass =
  "block cursor-pointer no-underline transition-colors duration-500 ease-out [-webkit-tap-highlight-color:transparent] " +
  "font-sans text-charcoal/75 tracking-[0.18em] hover:text-black font-normal " +
  "text-[0.62rem] sm:text-[0.65rem] leading-snug md:text-[0.68rem] " +
  linkFocus;

/**
 * Center name + right floating stills only (no site nav; interior pages use the global header).
 * Both the title and the stills link to / (work index).
 */
export function HomeExhibit() {
  const slides = useMemo(() => getHomeFrameSlides(), []);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <h1 className="pointer-events-auto absolute left-1/2 top-1/2 z-20 m-0 -translate-x-1/2 -translate-y-1/2 p-0 text-center">
        <Link href="/" className={nameLinkClass} aria-label="JACLYN FLEURANT — work">
          JACLYN FLEURANT
        </Link>
      </h1>

      {slides.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end px-5 sm:px-6 md:px-10">
          <div className="pointer-events-auto w-max">
            <Link href="/" className={workLinkClass} aria-label="View work">
              <HomeStillsCrossfade slides={slides} />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
