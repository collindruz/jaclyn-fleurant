"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WorldStill } from "@/lib/placeholders";
import { packWorldStills, type WorldPackSlot } from "@/lib/world-pack";
import Image from "next/image";
import {
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

type DraggableWorldProps = {
  stills: WorldStill[];
};

const scaleSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
  mass: 0.78,
};

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);

  const packed = useMemo(
    () => packWorldStills(list, board.w, board.h),
    [list, board.w, board.h]
  );

  const activate = useCallback((i: number) => {
    setActiveIndex(i);
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

  const reset = useCallback(() => {
    setActiveIndex(null);
    setEnlargedIndex(null);
  }, []);

  const onPrintTap = useCallback((i: number) => {
    setActiveIndex(i);
    setEnlargedIndex(i);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (enlargedIndex != null) {
          setEnlargedIndex(null);
          return;
        }
        reset();
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
  }, [enlargedIndex, reset, stepEnlarge]);

  if (n === 0) return null;

  const enlarged = enlargedIndex != null ? list[enlargedIndex] : null;
  const boardH = board.h || "calc(100dvh - 7.5rem)";

  return (
    <div
      className="relative w-full min-w-0 overflow-hidden touch-manipulation select-none"
      style={{ height: boardH, width: "100%" }}
      role="group"
      aria-label="Stills"
    >
      {list.map((still, i) => {
        const slot = packed.slots[i];
        if (!slot) return null;
        const isEnl = enlargedIndex === i;
        const isAct = activeIndex === i;
        const z = (isEnl ? 50_000 : 0) + (isAct ? 5_000 : 0) + 20 + i;
        return (
          <DraggablePrint
            key={`${i}-${still.src}`}
            src={still.src}
            width={still.width}
            height={still.height}
            index={i}
            n={n}
            slot={slot}
            zIndex={z}
            isActive={isAct}
            isEnlarged={isEnl}
            onActivate={() => activate(i)}
            onPrintTap={() => onPrintTap(i)}
            dragEnabled={enlargedIndex == null}
          />
        );
      })}

      {enlarged && enlargedIndex != null ? (
        <WorldEnlarge
          still={enlarged}
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

function stillAspect(still: WorldStill) {
  const natW = still.width > 32 ? still.width : 1600;
  const natH = still.height > 32 ? still.height : 2000;
  return { natW, natH, ratio: natW / natH };
}

function WorldEnlarge({
  still,
  index,
  n,
  onClose,
  onPrev,
  onNext,
}: {
  still: WorldStill;
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
            quality={90}
            priority
            draggable={false}
          />
        </motion.button>
      </AnimatePresence>
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
  zIndex: number;
  isActive: boolean;
  isEnlarged: boolean;
  onActivate: () => void;
  onPrintTap: () => void;
  dragEnabled: boolean;
};

function DraggablePrint({
  src,
  width,
  height,
  index,
  n,
  slot,
  zIndex,
  isActive,
  isEnlarged,
  onActivate,
  onPrintTap,
  dragEnabled,
}: DraggablePrintProps) {
  const { rotate } = useMemo(() => printVariant(src, index), [src, index]);
  const thumbSize = Math.max(24, Math.ceil(Math.max(slot.w, slot.h) * 2));
  const pointerStart = useRef({ x: 0, y: 0 });

  return (
    <motion.div
      className={`absolute border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bone ${
        dragEnabled
          ? "cursor-grab active:cursor-grabbing"
          : "pointer-events-none"
      }`}
      data-cursor="interactive"
      data-world-print=""
      data-index={index}
      data-active={isActive || undefined}
      style={{
        top: slot.y,
        left: slot.x,
        width: slot.w,
        height: slot.h,
        zIndex,
        transformOrigin: "center",
      }}
      role="button"
      tabIndex={dragEnabled ? 0 : -1}
      aria-pressed={isEnlarged}
      aria-label={`Still ${index + 1} of ${n}`}
      animate={{ scale: 1, rotate }}
      transition={scaleSpring}
      drag={dragEnabled}
      dragSnapToOrigin
      dragElastic={0.12}
      dragMomentum={false}
      onDragStart={onActivate}
      onPointerDown={(e) => {
        pointerStart.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const d = Math.hypot(
          e.clientX - pointerStart.current.x,
          e.clientY - pointerStart.current.y
        );
        if (d < 8) onPrintTap();
      }}
      onFocus={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPrintTap();
        }
      }}
    >
      <div data-world-image="" className="pointer-events-auto h-full w-full">
        <Image
          src={src}
          alt=""
          width={width}
          height={height}
          className="pointer-events-none block h-full w-full select-none object-contain object-center"
          sizes={`${thumbSize}px`}
          quality={70}
          draggable={false}
          priority={index < 24}
        />
      </div>
    </motion.div>
  );
}
