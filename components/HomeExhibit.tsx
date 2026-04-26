"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { getHomeFrameSlides } from "@/lib/home-frame-slides";
import { SITE_NAV } from "@/lib/site-nav";
import type { WorkMediaKind } from "@/lib/work-types";

/** Soft crossfade duration (ease-in-out; overlap reads as a gentle blend). */
const FADE_MS = 1400;
/** Time each slide is fully legible before the next crossfade. */
const HOLD_MS = 2500;

type Slide = { kind: WorkMediaKind; src: string };

function SlideMedia({ slide }: { slide: Slide }) {
  if (slide.kind === "video") {
    return (
      <div className="absolute inset-0" key={slide.src}>
        <video
          className="h-full w-full object-cover"
          src={slide.src}
          muted
          loop
          playsInline
          autoPlay
          aria-hidden
        />
      </div>
    );
  }
  return (
    <div className="absolute inset-0">
      <Image
        src={slide.src}
        alt=""
        fill
        className="object-contain object-center"
        sizes="(max-width: 640px) 40vw, 200px"
        draggable={false}
      />
    </div>
  );
}

/** Borderless float: ~7–9rem mobile, ~9–12rem desktop. */
const stillClass =
  "relative w-[min(8.5rem,78vw)] shrink-0 overflow-hidden bg-transparent sm:w-[8.5rem] md:w-[10rem] lg:w-[11rem] xl:w-[12rem] xl:max-w-[12rem]";

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
      <div className={stillClass} style={{ aspectRatio: "4 / 5" }}>
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
    <div className={stillClass} style={{ aspectRatio: "4 / 5" }}>
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

const homeNavLinkClass =
  "font-sans text-[0.57rem] font-normal normal-case tracking-[0.1em] no-underline transition-colors duration-700 " +
  "text-charcoal/28 hover:text-charcoal/62 " +
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-charcoal/20";

/**
 * Name = viewport center; nav + stills share one right column so “World” and stills
 * left edges align; both link targets stay /work.
 */
export function HomeExhibit() {
  const slides = useMemo(() => getHomeFrameSlides(), []);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <h1 className="pointer-events-auto absolute left-1/2 top-1/2 z-20 m-0 -translate-x-1/2 -translate-y-1/2 p-0 text-center">
        <Link href="/work" className={nameLinkClass} aria-label="JACLYN FLEURANT — work">
          JACLYN FLEURANT
        </Link>
      </h1>

      <div className="pointer-events-none absolute inset-0 flex justify-end">
        <div className="h-full w-full max-w-6xl px-5 sm:px-6 md:px-10">
          {/*
            In-flow nav sets column width; stills are absolutely positioned in the
            same box so the image’s left edge matches the left edge of “World”.
          */}
          <div className="relative ml-auto h-full w-max min-w-0 max-w-full">
            <nav className="pointer-events-auto relative z-30 w-max pt-5" aria-label="Main">
              <ul className="m-0 flex list-none flex-wrap justify-start gap-x-4 gap-y-1.5 p-0 sm:gap-x-6 md:gap-x-7 lg:gap-x-9">
                {SITE_NAV.map((item) => (
                  <li key={item.href} className="m-0 p-0">
                    <Link href={item.href} className={homeNavLinkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {slides.length > 0 ? (
              <div className="pointer-events-auto absolute left-0 top-1/2 z-10 w-max -translate-y-1/2">
                <Link href="/work" className={workLinkClass} aria-label="View work">
                  <HomeStillsCrossfade slides={slides} />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
