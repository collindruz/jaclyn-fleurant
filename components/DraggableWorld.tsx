"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { WorldStill } from "@/lib/placeholders";
import { packWorldStills, type WorldPackSlot } from "@/lib/world-pack";
import { STACK_VIEWER } from "@/lib/stacking";
import { releaseWorldThumbs, requestWorldThumb } from "@/lib/world-thumb";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const TAP_MOVE_PX = 16;
const SWIPE_PX = 48;
const WHEEL_LOCK_MS = 560;
const THUMB_EAGER_COUNT = 36;
const THUMB_REST_FILTER = "[filter:grayscale(1)_contrast(1.08)]";

type DraggableWorldProps = {
  stills: WorldStill[];
};

function stillAspect(still: WorldStill) {
  const natW = still.width > 32 ? still.width : 1600;
  const natH = still.height > 32 ? still.height : 2000;
  return { natW, natH, ratio: natW / natH };
}

function readSafeInsetBottom() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const bottom = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return bottom;
}

function useWorldBoard() {
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const header = document.querySelector("header");
      const hh = header ? header.getBoundingClientRect().height : 0;
      const viewportH = window.visualViewport?.height ?? window.innerHeight;
      const safeBottom = readSafeInsetBottom();
      const next = {
        w: Math.round(window.innerWidth),
        h: Math.round(Math.max(64, viewportH - hh - safeBottom)),
      };
      setBox((prev) =>
        prev.w === next.w && prev.h === next.h ? prev : next
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const header = document.querySelector("header");
    const ro = header ? new ResizeObserver(measure) : null;
    if (header && ro) ro.observe(header);

    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      ro?.disconnect();
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return box;
}

export function DraggableWorld({ stills }: DraggableWorldProps) {
  const list = stills;
  const n = list.length;
  const board = useWorldBoard();
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);

  const packed = useMemo(
    () => packWorldStills(list, board.w, board.h),
    [list, board.w, board.h]
  );

  useEffect(() => {
    return () => releaseWorldThumbs();
  }, []);

  const closeEnlarge = useCallback(() => {
    setEnlargedIndex(null);
  }, []);

  const stepEnlarge = useCallback(
    (dir: number) => {
      if (n < 2) return;
      setEnlargedIndex((cur) => {
        if (cur == null) return cur;
        return (cur + dir + n) % n;
      });
    },
    [n]
  );

  const onPrintTap = useCallback((i: number) => {
    setEnlargedIndex(i);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (enlargedIndex != null) setEnlargedIndex(null);
        return;
      }
      if (enlargedIndex == null) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepEnlarge(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepEnlarge(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlargedIndex, stepEnlarge]);

  if (n === 0) return null;

  const enlarged = enlargedIndex != null ? list[enlargedIndex] : null;
  const nextStill =
    enlargedIndex != null && n > 1 ? list[(enlargedIndex + 1) % n] : null;
  const viewerOpen = enlargedIndex != null;
  const boardH = board.h > 0 ? board.h : undefined;
  const packReady = packed.slots.length > 0;

  return (
    <div
      className="relative w-full min-w-0 overflow-hidden overscroll-none select-none"
      data-world-board=""
      data-thumb-max-h={packed.thumbMaxH}
      data-pack-gap={packed.gap}
      data-pack-pad={packed.pad}
      style={{
        height: boardH,
        width: "100%",
        minHeight: boardH ? undefined : "50vh",
        padding: 0,
        opacity: packReady ? 1 : 0,
      }}
      role="group"
      aria-label="Stills"
    >
      <div
        aria-hidden={viewerOpen}
        style={{
          visibility: viewerOpen ? "hidden" : "visible",
          pointerEvents: viewerOpen ? "none" : "auto",
        }}
      >
        {list.map((still, i) => {
          const slot = packed.slots[i];
          if (!slot) return null;
          return (
            <WorldPrint
              key={still.src}
              src={still.src}
              index={i}
              n={n}
              slot={slot}
              isEnlarged={enlargedIndex === i}
              onPrintTap={onPrintTap}
              eager={i < THUMB_EAGER_COUNT}
            />
          );
        })}
      </div>

      {enlarged && enlargedIndex != null
        ? createPortal(
            <WorldEnlarge
              still={enlarged}
              nextStill={nextStill}
              index={enlargedIndex}
              n={n}
              onClose={closeEnlarge}
              onPrev={() => stepEnlarge(-1)}
              onNext={() => stepEnlarge(1)}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function WorldEnlarge({
  still,
  nextStill,
  index,
  n,
  onClose,
  onPrev,
  onNext,
}: {
  still: WorldStill;
  nextStill: WorldStill | null;
  index: number;
  n: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const wheelLock = useRef(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const canStep = n > 1;
  const { natW, natH, ratio } = stillAspect(still);
  const fade = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!canStep) return;
      const now = performance.now();
      if (now - wheelLock.current < WHEEL_LOCK_MS) return;
      const ax = Math.abs(e.deltaX);
      const ay = Math.abs(e.deltaY);
      if (ax < 14 && ay < 14) return;
      wheelLock.current = now;
      if (ay >= ax) {
        if (e.deltaY > 0) onNext();
        else onPrev();
      } else if (e.deltaX > 0) {
        onNext();
      } else {
        onPrev();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [canStep, onNext, onPrev]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    skipClick.current = false;
  };

  const finishPointer = (clientX: number, clientY: number) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    const dist = Math.hypot(dx, dy);
    if (canStep && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.15) {
      skipClick.current = true;
      if (dx < 0) onNext();
      else onPrev();
      return;
    }
    if (dist >= TAP_MOVE_PX) {
      skipClick.current = true;
    }
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    onClose();
  };

  const onPhotoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (canStep) onNext();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden overscroll-none"
      style={{ zIndex: STACK_VIEWER }}
      data-world-viewer=""
      role="dialog"
      aria-modal="true"
      aria-label={`Still ${index + 1} of ${n}, enlarged`}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      onPointerUp={(e) => finishPointer(e.clientX, e.clientY)}
      onPointerCancel={() => {
        pointerStart.current = null;
        skipClick.current = true;
      }}
      onClick={onBackdropClick}
    >
      <div className="pointer-events-none absolute inset-0 bg-bone/80" aria-hidden />
      <AnimatePresence mode="wait" initial={false}>
        <motion.button
          key={still.src}
          type="button"
          data-cursor="interactive"
          aria-label={
            canStep
              ? `Still ${index + 1} of ${n}. Next still.`
              : `Still ${index + 1} of ${n}`
          }
          className="relative z-10 block max-h-[85vh] max-w-[90vw] cursor-pointer border-0 bg-transparent p-0"
          style={{
            aspectRatio: `${natW} / ${natH}`,
            width: `min(90vw, calc(85vh * ${ratio}))`,
            height: "auto",
          }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={fade}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            finishPointer(e.clientX, e.clientY);
          }}
          onClick={onPhotoClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={still.src}
            alt=""
            width={natW}
            height={natH}
            className="pointer-events-none h-auto w-full select-none object-contain object-center"
            decoding="async"
            draggable={false}
          />
        </motion.button>
      </AnimatePresence>
      {nextStill ? (
        <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={nextStill.src}
            alt=""
            width={nextStill.width > 32 ? nextStill.width : 1600}
            height={nextStill.height > 32 ? nextStill.height : 2000}
            decoding="async"
            draggable={false}
          />
        </div>
      ) : null}
    </div>
  );
}

type WorldPrintProps = {
  src: string;
  index: number;
  n: number;
  slot: WorldPackSlot;
  isEnlarged: boolean;
  onPrintTap: (index: number) => void;
  eager: boolean;
};

const WorldPrint = memo(function WorldPrint({
  src,
  index,
  n,
  slot,
  isEnlarged,
  onPrintTap,
  eager,
}: WorldPrintProps) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const tw = Math.max(1, Math.round(slot.w * dpr));
    const th = Math.max(1, Math.round(slot.h * dpr));
    requestWorldThumb(src, tw, th)
      .then((url) => {
        if (!cancelled) setThumbSrc(url);
      })
      .catch(() => {
        if (!cancelled) setThumbSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src, slot.w, slot.h]);

  return (
    <button
      type="button"
      className="absolute cursor-pointer border-0 bg-transparent p-0 [content-visibility:auto] focus:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bone"
      data-cursor="interactive"
      data-world-print=""
      data-index={index}
      data-slot-w={Math.round(slot.w)}
      data-slot-h={Math.round(slot.h)}
      style={{
        top: slot.y,
        left: slot.x,
        width: slot.w,
        height: slot.h,
        zIndex: 20 + index,
        contain: "layout style",
        containIntrinsicSize: `${Math.ceil(slot.w)}px ${Math.ceil(slot.h)}px`,
      }}
      aria-pressed={isEnlarged}
      aria-label={`Still ${index + 1} of ${n}`}
      onClick={() => onPrintTap(index)}
    >
      <div data-world-image="" className="group/still h-full w-full">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt=""
            width={Math.max(1, Math.round(slot.w))}
            height={Math.max(1, Math.round(slot.h))}
            className={`pointer-events-none block h-full w-full select-none object-contain object-center transition-[filter] duration-[550ms] ease-in-out motion-reduce:duration-75 ${
              isEnlarged
                ? "[filter:none] grayscale-0"
                : `${THUMB_REST_FILTER} md:group-hover/still:grayscale-0 md:group-hover/still:[filter:none]`
            }`}
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={index < 4 ? "high" : "auto"}
            decoding="async"
          />
        ) : null}
      </div>
    </button>
  );
});
