"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import Image from "next/image";
import { WORLD_STILLS_MAX } from "@/lib/world-stills-bounds";
import type { MouseEvent, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type DraggableWorldProps = {
  srcs: string[];
};

/**
 * Collage: desktop = left / center / right with varied tops; mobile = same band stacked
 * but `left` staggered (12%, 38%, 68% and between) so stills are not a single left column.
 */
const PRINTS: {
  m: { t: string; l: string; w: string };
  d: { t: string; l: string; w: string };
}[] = [
  { m: { t: "0%", l: "12%", w: "58%" }, d: { t: "5%", l: "5%", w: "21%" } },
  { m: { t: "16%", l: "32%", w: "54%" }, d: { t: "4%", l: "38%", w: "20%" } },
  { m: { t: "6%", l: "2%", w: "64%" }, d: { t: "8%", l: "66%", w: "20%" } },
  { m: { t: "34%", l: "8%", w: "58%" }, d: { t: "38%", l: "12%", w: "22%" } },
  { m: { t: "24%", l: "38%", w: "52%" }, d: { t: "32%", l: "40%", w: "20%" } },
  { m: { t: "48%", l: "4%", w: "62%" }, d: { t: "30%", l: "68%", w: "20%" } },
  { m: { t: "58%", l: "22%", w: "55%" }, d: { t: "58%", l: "6%", w: "21%" } },
  { m: { t: "42%", l: "2%", w: "58%" }, d: { t: "52%", l: "38%", w: "20%" } },
  { m: { t: "72%", l: "10%", w: "56%" }, d: { t: "10%", l: "68%", w: "19%" } },
  { m: { t: "64%", l: "28%", w: "50%" }, d: { t: "62%", l: "58%", w: "20%" } },
];

/** Rest (non-enlarged) only: press / drag nudge. */
const INTERACTION_SCALE = 1.1;
/**
 * Enlarge only via motion `scale` (layout width unchanged). Resting print layout is fixed; all
 * size change is `transform: scale` from `printVariant`’s `baseScale`.
 */
const ENLARGED_MULT = 2.0;
/** `whileDrag` / `whileTap` when enlarged: at most `baseScale` × this (2.5% over 2×). */
const ENLARGED_DRAG_MAX_MULT = 2.05;

const resetTransition = {
  type: "spring" as const,
  stiffness: 360,
  damping: 34,
  mass: 0.85,
};

const scaleSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
  mass: 0.78,
};

const whileDragTransition = {
  type: "spring" as const,
  stiffness: 520,
  damping: 32,
  mass: 0.45,
};

/** Below this, movement is treated as jitter; above, the gesture is a drag (blocks `onTap`). */
const DRAG_MOVE_THRESHOLD_PX = 6;
/** After a drag, ignore `onTap` for this long (Framer can fire tap after release). */
const DRAG_TAP_SUPPRESS_MS = 120;

/**
 * Per-print “random” but stable: same `src` + `index` always yields the same rotate/scale
 * (SSR-safe, no flicker; reset remount does not need to re-roll).
 */
function printVariant(src: string, index: number) {
  let h = 2166136261;
  const s = `${src}#${index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const r0 = h / 0xffff_ffff;
  const t = Math.imul(h, 0x9e37_79b1) >>> 0;
  const r1 = t / 0xffff_ffff;
  const rotate = -2.5 + r0 * 5;
  const scale = 0.82 + r1 * 0.08;
  return { rotate, scale };
}

function useIsMd() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  );
}

export function DraggableWorld({ srcs }: DraggableWorldProps) {
  const list = useMemo(
    () => srcs.slice(0, WORLD_STILLS_MAX),
    [srcs]
  );
  const n = list.length;
  const areaId = useId();
  const constraintsRef = useRef<HTMLDivElement>(null);
  /** Top of stack when dragging, tapping, or not enlarged. */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  /** Single print enlarged, or `null` — no layout jump; `transform: scale` only. */
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);
  /** Increments to trigger a smooth (spring) return of all drags to origin. */
  const [resetTick, setResetTick] = useState(0);

  const activate = useCallback((i: number) => {
    setActiveIndex(i);
  }, []);

  const onPrintTap = useCallback(
    (i: number) => {
      if (enlargedIndex !== null) {
        setEnlargedIndex(null);
        return;
      }
      if (activeIndex === i) {
        setEnlargedIndex(i);
      } else {
        setActiveIndex(i);
      }
    },
    [enlargedIndex, activeIndex]
  );

  const reset = useCallback(() => {
    setActiveIndex(null);
    setEnlargedIndex(null);
    setResetTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (enlargedIndex !== null) {
        setEnlargedIndex(null);
      } else {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlargedIndex, reset]);

  const onWorldClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (enlargedIndex === null) return;
      if ((e.target as Element).closest?.("[data-world-print]")) return;
      setEnlargedIndex(null);
    },
    [enlargedIndex]
  );

  if (n === 0) return null;

  return (
    <div className="w-full" onClick={onWorldClick}>
      <p
        className="mb-8 text-center font-sans text-[0.7rem] font-normal tracking-[0.12em] text-charcoal/35 md:mb-10"
        id={`${areaId}-hint`}
      >
        move the stills — first tap to select, second to enlarge; tap off the stills to shrink
      </p>
      {/*
        Drag bounds = this padded, viewport-tall box so stills stay mostly on screen.
        Replaces a very tall (130dvh) play area that let images drift far out of view.
      */}
      <div className="w-full max-w-none overflow-clip">
        <div
          ref={constraintsRef}
          className="relative box-border w-full touch-manipulation select-none px-0 py-1 sm:px-2 sm:py-2 md:px-3 md:py-3"
          style={{ height: "min(100dvh, 1100px)" }}
          role="group"
          aria-labelledby={`${areaId}-hint`}
          aria-label="Loose stills: drag to move, first tap a still to select, second to enlarge, tap a print to shrink when enlarged, tap empty area or press Escape. Escape otherwise resets all."
        >
        {list.map((src, i) => {
          const L = PRINTS[i] ?? PRINTS[i % PRINTS.length]!;
          const isEnl = enlargedIndex === i;
          const isAct = activeIndex === i;
          const z =
            isEnl ? 2000 : isAct ? 600 : 20 + i;
          return (
            <DraggablePrint
              key={`${i}-${src}`}
              src={src}
              index={i}
              n={n}
              layoutM={L.m}
              layoutD={L.d}
              zIndex={z}
              isActive={isAct}
              isEnlarged={isEnl}
              onActivate={() => activate(i)}
              onPrintTap={() => onPrintTap(i)}
              dragConstraints={constraintsRef}
              resetTick={resetTick}
            />
          );
        })}
        </div>
      </div>
    </div>
  );
}

type DraggablePrintProps = {
  src: string;
  index: number;
  n: number;
  layoutM: (typeof PRINTS)[0]["m"];
  layoutD: (typeof PRINTS)[0]["d"];
  zIndex: number;
  isActive: boolean;
  isEnlarged: boolean;
  onActivate: () => void;
  onPrintTap: () => void;
  dragConstraints: RefObject<HTMLDivElement | null>;
  resetTick: number;
};

function DraggablePrint({
  src,
  index,
  n,
  layoutM,
  layoutD,
  zIndex,
  isActive,
  isEnlarged,
  onActivate,
  onPrintTap,
  dragConstraints,
  resetTick,
}: DraggablePrintProps) {
  const isMd = useIsMd();
  const reduceMotion = useReducedMotion();
  const L = isMd ? layoutD : layoutM;
  const { rotate, scale: baseScale } = useMemo(
    () => printVariant(src, index),
    [src, index]
  );
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const printRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  /** `true` after movement past threshold — blocks tap until 120ms after drag end. */
  const sawOnDragRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragEndSuppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  /** `true` for 120ms after any pan that moved (even under threshold) — Framer can still fire onTap. */
  const postGestureTapBlockRef = useRef(false);

  useEffect(() => {
    if (resetTick === 0) return;
    const ax = animate(x, 0, resetTransition);
    const ay = animate(y, 0, resetTransition);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [resetTick, x, y]);

  useEffect(() => {
    return () => {
      if (dragEndSuppressTimeoutRef.current !== null) {
        clearTimeout(dragEndSuppressTimeoutRef.current);
      }
    };
  }, []);

  /*
   * Scale (motion `transform`, layout unchanged):
   * - rest: baseScale
   * - enlarged: baseScale * 2
   * - drag / tap when enlarged: baseScale * 2.05 max (tiny nudge; not × INTERACTION_SCALE)
   * - not enlarged + drag / tap: baseScale * INTERACTION_SCALE
   */
  const restScale = isEnlarged
    ? baseScale * ENLARGED_MULT
    : baseScale;
  const interactionScale = isEnlarged
    ? baseScale * ENLARGED_DRAG_MAX_MULT
    : baseScale * INTERACTION_SCALE;

  const handleDragStart = useCallback(
    (_: unknown, info: PanInfo) => {
      didDragRef.current = false;
      sawOnDragRef.current = false;
      postGestureTapBlockRef.current = false;
      dragStartPosRef.current = { x: info.point.x, y: info.point.y };
      onActivate();
    },
    [onActivate]
  );

  const handleDrag = useCallback((_: unknown, info: PanInfo) => {
    sawOnDragRef.current = true;
    const s = dragStartPosRef.current;
    if (s) {
      const d = Math.hypot(info.point.x - s.x, info.point.y - s.y);
      if (d > DRAG_MOVE_THRESHOLD_PX) {
        didDragRef.current = true;
      }
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStartPosRef.current = null;
    if (!sawOnDragRef.current) return;
    sawOnDragRef.current = false;
    if (dragEndSuppressTimeoutRef.current !== null) {
      clearTimeout(dragEndSuppressTimeoutRef.current);
    }
    postGestureTapBlockRef.current = true;
    dragEndSuppressTimeoutRef.current = setTimeout(() => {
      didDragRef.current = false;
      postGestureTapBlockRef.current = false;
      dragEndSuppressTimeoutRef.current = null;
    }, DRAG_TAP_SUPPRESS_MS);
  }, []);

  return (
    <motion.div
      ref={printRef}
      className="absolute cursor-grab p-0 active:cursor-grabbing"
      data-cursor="interactive"
      data-world-print=""
      data-index={index}
      data-active={isActive || undefined}
      style={{
        top: L.t,
        left: L.l,
        width: L.w,
        x,
        y,
        zIndex,
        transformOrigin: "center",
      }}
      animate={{ scale: restScale, rotate }}
      transition={scaleSpring}
      drag
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      dragConstraints={dragConstraints}
      dragElastic={0.04}
      dragMomentum={!reduceMotion}
      dragTransition={{
        power: 0.1,
        timeConstant: 200,
        restDelta: 0.4,
      }}
      whileDrag={{ scale: interactionScale, transition: whileDragTransition }}
      whileTap={{ scale: interactionScale, transition: whileDragTransition }}
      onTap={(e) => {
        if (didDragRef.current || postGestureTapBlockRef.current) return;
        (e as Event | undefined)?.stopPropagation?.();
        onPrintTap();
      }}
      onFocus={onActivate}
      tabIndex={0}
      role="button"
      aria-pressed={isEnlarged}
      aria-label={`Still ${index + 1} of ${n}, draggable. First tap to select, second to enlarge; when enlarged, tap a still or the background to close.`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPrintTap();
        }
      }}
    >
      <div className="relative aspect-[3/4] w-full max-w-[9.5rem] sm:max-w-[9rem] sm:aspect-[4/5] md:max-w-[8.5rem]">
        {/*
            next/image: priority on first 2; lazy for rest. Borderless, no mat.
        */}
        <Image
          src={src}
          alt=""
          fill
          className="pointer-events-none object-contain"
          sizes="(max-width: 768px) 36vw, 20vw"
          draggable={false}
          decoding="async"
          priority={index < 2}
          loading={index < 2 ? undefined : "lazy"}
        />
      </div>
    </motion.div>
  );
}
