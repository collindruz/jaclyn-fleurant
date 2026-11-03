"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WorldStill } from "@/lib/placeholders";
import { packWorldStills, type WorldPackSlot } from "@/lib/world-pack";
import Image from "next/image";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const WORLD_VIEWER_Z = 60000;
const TAP_MOVE_PX = 16;
const SWIPE_PX = 48;
const WHEEL_LOCK_MS = 560;
const PRINT_TAP_PX = 8;
const THUMB_QUALITY = 60;
const VIEWER_QUALITY = 85;
const THUMB_EAGER_COUNT = 12;
const THUMB_BATCH = 16;

type DraggableWorldProps = {
  stills: WorldStill[];
};

function stillAspect(still: WorldStill) {
  const natW = still.width > 32 ? still.width : 1600;
  const natH = still.height > 32 ? still.height : 2000;
  return { natW, natH, ratio: natW / natH };
}

function printVariant(src: string, index: number) {
  let h = 2166136261;
  const s = `${src}#${index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const r0 = h / 0xffff_ffff;
  const rotate = -1.2 + r0 * 2.4;
  return { rotate };
}

function useWorldBoard() {
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const header = document.querySelector("header");
      const hh = header ? header.getBoundingClientRect().height : 0;
      setBox({
        w: window.innerWidth,
        h: Math.max(64, window.innerHeight - hh),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    const header = document.querySelector("header");
    const ro = header ? new ResizeObserver(measure) : null;
    if (header && ro) ro.observe(header);
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return box;
}

export function DraggableWorld({ stills }: DraggableWorldProps) {
  const list = stills;
  const n = list.length;
  const board = useWorldBoard();
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);
  const [thumbLimit, setThumbLimit] = useState(THUMB_EAGER_COUNT);

  const packed = useMemo(
    () => packWorldStills(list, board.w, board.h),
    [list, board.w, board.h]
  );

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
    if (enlargedIndex != null) return;
    if (thumbLimit >= n) return;
    let cancelled = false;
    const bump = () => {
      if (cancelled) return;
      setThumbLimit((c) => Math.min(n, c + THUMB_BATCH));
    };
    let idleId = 0;
    let timeoutId = 0;
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(bump, { timeout: 180 });
    } else {
      timeoutId = window.setTimeout(bump, 48);
    }
    return () => {
      cancelled = true;
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [thumbLimit, n, enlargedIndex]);

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
  const boardH = board.h || "calc(100dvh - 7.5rem)";
  const viewerOpen = enlargedIndex != null;

  return (
    <div
      className="relative w-full min-w-0 overflow-hidden touch-manipulation select-none"
      style={{ height: boardH, width: "100%" }}
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
            <DraggablePrint
              key={`${i}-${still.src}`}
              src={still.src}
              width={still.width}
              height={still.height}
              index={i}
              n={n}
              slot={slot}
              isEnlarged={enlargedIndex === i}
              onPrintTap={onPrintTap}
              dragEnabled={!viewerOpen}
              eager={i < THUMB_EAGER_COUNT}
              showImage={i < thumbLimit}
            />
          );
        })}
      </div>

      {enlarged && enlargedIndex != null ? (
        <WorldEnlarge
          still={enlarged}
          nextStill={nextStill}
          index={enlargedIndex}
          n={n}
          onClose={closeEnlarge}
          onPrev={() => stepEnlarge(-1)}
          onNext={() => stepEnlarge(1)}
        />
      ) : null}
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
  const reduceMotion = useReducedMotion() ?? false;
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
      style={{ zIndex: WORLD_VIEWER_Z }}
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
          <Image
            src={still.src}
            alt=""
            width={natW}
            height={natH}
            className="pointer-events-none h-auto w-full select-none object-contain object-center"
            sizes="90vw"
            quality={VIEWER_QUALITY}
            priority
            draggable={false}
          />
        </motion.button>
      </AnimatePresence>
      {nextStill ? (
        <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
          <Image
            src={nextStill.src}
            alt=""
            width={nextStill.width > 32 ? nextStill.width : 1600}
            height={nextStill.height > 32 ? nextStill.height : 2000}
            sizes="90vw"
            quality={VIEWER_QUALITY}
            draggable={false}
          />
        </div>
      ) : null}
    </div>
  );
}

type DraggablePrintProps = {
  src: string;
  width: number;
  height: number;
  index: number;
  n: number;
  slot: WorldPackSlot;
  isEnlarged: boolean;
  onPrintTap: (index: number) => void;
  dragEnabled: boolean;
  eager: boolean;
  showImage: boolean;
};

const DraggablePrint = memo(function DraggablePrint({
  src,
  width,
  height,
  index,
  n,
  slot,
  isEnlarged,
  onPrintTap,
  dragEnabled,
  eager,
  showImage,
}: DraggablePrintProps) {
  const { rotate } = useMemo(() => printVariant(src, index), [src, index]);
  const nodeRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const pressed = useRef(false);
  const displayW = Math.max(1, Math.ceil(slot.w));

  const applyTransform = (x: number, y: number, snapping: boolean) => {
    const el = nodeRef.current;
    if (!el) return;
    el.style.transition = snapping
      ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`;
  };

  return (
    <div
      ref={nodeRef}
      className={`absolute border-0 bg-transparent p-0 [content-visibility:auto] focus:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bone ${
        dragEnabled
          ? "cursor-grab active:cursor-grabbing"
          : "pointer-events-none"
      }`}
      data-cursor="interactive"
      data-world-print=""
      data-index={index}
      style={{
        top: slot.y,
        left: slot.x,
        width: slot.w,
        height: slot.h,
        zIndex: 20 + index,
        transform: `translate3d(0, 0, 0) rotate(${rotate}deg)`,
        transformOrigin: "center",
        contain: "layout style",
        containIntrinsicSize: `${Math.ceil(slot.w)}px ${Math.ceil(slot.h)}px`,
        touchAction: dragEnabled ? "none" : undefined,
      }}
      role="button"
      tabIndex={dragEnabled ? 0 : -1}
      aria-pressed={isEnlarged}
      aria-label={`Still ${index + 1} of ${n}`}
      onPointerDown={(e) => {
        if (!dragEnabled) return;
        pressed.current = true;
        pointerStart.current = { x: e.clientX, y: e.clientY };
        dragging.current = false;
        const el = nodeRef.current;
        if (el) {
          el.style.zIndex = "8000";
          el.style.willChange = "transform";
        }
        applyTransform(0, 0, false);
        el?.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragEnabled || !pressed.current) return;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        if (!dragging.current && Math.hypot(dx, dy) < PRINT_TAP_PX) return;
        dragging.current = true;
        applyTransform(dx, dy, false);
      }}
      onPointerUp={(e) => {
        if (!pressed.current) return;
        pressed.current = false;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        const d = Math.hypot(dx, dy);
        const el = nodeRef.current;
        if (el) el.style.willChange = "auto";
        if (dragging.current || d >= PRINT_TAP_PX) {
          dragging.current = false;
          applyTransform(0, 0, true);
          return;
        }
        dragging.current = false;
        applyTransform(0, 0, false);
        onPrintTap(index);
      }}
      onPointerCancel={() => {
        pressed.current = false;
        dragging.current = false;
        applyTransform(0, 0, true);
        const el = nodeRef.current;
        if (el) el.style.willChange = "auto";
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPrintTap(index);
        }
      }}
    >
      <div data-world-image="" className="group/still pointer-events-auto h-full w-full">
        {showImage ? (
          <Image
            src={src}
            alt=""
            width={width}
            height={height}
            className={`pointer-events-none block h-full w-full select-none object-contain object-center transition-[filter] duration-[550ms] ease-in-out motion-reduce:duration-75 ${
              isEnlarged
                ? "grayscale-0"
                : "grayscale md:group-hover/still:grayscale-0"
            }`}
            sizes={`${displayW}px`}
            quality={THUMB_QUALITY}
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={index < 4 ? "high" : "auto"}
            decoding="async"
          />
        ) : null}
      </div>
    </div>
  );
});
