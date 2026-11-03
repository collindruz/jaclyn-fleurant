"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WorldStill } from "@/lib/placeholders";
import { packWorldStills, worldPrintRotate, type WorldPackSlot } from "@/lib/world-pack";
import { STACK_VIEWER } from "@/lib/stacking";
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
import { createPortal } from "react-dom";
const TAP_MOVE_PX = 16;
const SWIPE_PX = 48;
const WHEEL_LOCK_MS = 560;
const PRINT_TAP_PX = 10;
const PRINT_TAP_TOUCH_PX = 14;
const THUMB_QUALITY = 60;
const VIEWER_QUALITY = 85;
const THUMB_EAGER_COUNT = 12;
const THUMB_BATCH = 16;
const GOLDEN_FILTER =
  "[filter:sepia(0.46)_saturate(0.7)_brightness(1.02)_hue-rotate(-8deg)_contrast(0.97)]";

type DragPose = { x: number; y: number; z: number | null };

type DraggableWorldProps = {
  stills: WorldStill[];
};

function stillAspect(still: WorldStill) {
  const natW = still.width > 32 ? still.width : 1600;
  const natH = still.height > 32 ? still.height : 2000;
  return { natW, natH, ratio: natW / natH };
}

function printVariant(src: string, index: number) {
  return { rotate: worldPrintRotate(src, index) };
}

function useWorldBoardWidth() {
  const [w, setW] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      setW(window.innerWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  return w;
}

export function DraggableWorld({ stills }: DraggableWorldProps) {
  const list = stills;
  const n = list.length;
  const boardW = useWorldBoardWidth();
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);
  const [thumbLimit, setThumbLimit] = useState(THUMB_EAGER_COUNT);
  const posesRef = useRef(new Map<string, DragPose>());
  const zSeqRef = useRef(400);

  const packed = useMemo(() => packWorldStills(list, boardW), [list, boardW]);

  const bumpZ = useCallback(() => {
    zSeqRef.current += 1;
    return 400 + zSeqRef.current;
  }, []);

  const getPose = useCallback((id: string): DragPose => {
    let pose = posesRef.current.get(id);
    if (!pose) {
      pose = { x: 0, y: 0, z: null };
      posesRef.current.set(id, pose);
    }
    return pose;
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

  useEffect(() => {
    if (enlargedIndex == null) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [enlargedIndex]);

  if (n === 0) return null;

  const enlarged = enlargedIndex != null ? list[enlargedIndex] : null;
  const nextStill =
    enlargedIndex != null && n > 1 ? list[(enlargedIndex + 1) % n] : null;
  const viewerOpen = enlargedIndex != null;
  const boardH = packed.totalH > 0 ? packed.totalH : undefined;

  return (
    <div
      className="relative w-full min-w-0 overflow-x-clip overflow-y-visible touch-pan-y select-none"
      style={{ height: boardH, width: "100%", minHeight: boardH ? undefined : "50vh" }}
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
              key={still.src}
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
              getPose={getPose}
              bumpZ={bumpZ}
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
  getPose: (id: string) => DragPose;
  bumpZ: () => number;
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
  getPose,
  bumpZ,
}: DraggablePrintProps) {
  const { rotate } = useMemo(() => printVariant(src, index), [src, index]);
  const nodeRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const pressed = useRef(false);
  const scrollIntent = useRef(false);
  const isTouch = useRef(false);
  const displayW = Math.max(1, Math.ceil(slot.w));
  const pose = getPose(src);

  const writeTransform = (x: number, y: number) => {
    const el = nodeRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`;
  };

  useLayoutEffect(() => {
    const p = getPose(src);
    writeTransform(p.x, p.y);
    const el = nodeRef.current;
    if (el) el.style.zIndex = String(p.z ?? slot.z);
    // slot origin is via top/left; drag offset stays in the transform
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, slot.x, slot.y, slot.w, slot.h, slot.z, rotate, getPose]);

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
      data-overlaps={slot.overlaps ? "1" : "0"}
      data-slot-w={Math.round(slot.w)}
      data-slot-h={Math.round(slot.h)}
      style={{
        top: slot.y,
        left: slot.x,
        width: slot.w,
        height: slot.h,
        zIndex: pose.z ?? slot.z,
        transform: `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${rotate}deg)`,
        transformOrigin: "center",
        contain: "layout style",
        containIntrinsicSize: `${Math.ceil(slot.w)}px ${Math.ceil(slot.h)}px`,
        touchAction: dragEnabled ? "pan-y" : undefined,
      }}
      role="button"
      tabIndex={dragEnabled ? 0 : -1}
      aria-pressed={isEnlarged}
      aria-label={`Still ${index + 1} of ${n}`}
      onPointerDown={(e) => {
        if (!dragEnabled) return;
        pressed.current = true;
        dragging.current = false;
        scrollIntent.current = false;
        isTouch.current = e.pointerType === "touch";
        pointerStart.current = { x: e.clientX, y: e.clientY };
        const p = getPose(src);
        origin.current = { x: p.x, y: p.y };
        const el = nodeRef.current;
        if (el) {
          p.z = bumpZ();
          el.style.zIndex = String(p.z);
          el.style.willChange = "transform";
        }
        if (!isTouch.current) {
          el?.setPointerCapture?.(e.pointerId);
        }
      }}
      onPointerMove={(e) => {
        if (!dragEnabled || !pressed.current || scrollIntent.current) return;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        const tap = isTouch.current ? PRINT_TAP_TOUCH_PX : PRINT_TAP_PX;
        if (!dragging.current && Math.hypot(dx, dy) < tap) return;
        if (!dragging.current && isTouch.current && Math.abs(dy) > Math.abs(dx) * 1.15) {
          scrollIntent.current = true;
          pressed.current = false;
          const el = nodeRef.current;
          if (el) el.style.willChange = "auto";
          return;
        }
        if (!dragging.current) {
          dragging.current = true;
          nodeRef.current?.setPointerCapture?.(e.pointerId);
        }
        const p = getPose(src);
        p.x = origin.current.x + dx;
        p.y = origin.current.y + dy;
        writeTransform(p.x, p.y);
      }}
      onPointerUp={(e) => {
        if (scrollIntent.current) {
          scrollIntent.current = false;
          pressed.current = false;
          dragging.current = false;
          return;
        }
        if (!pressed.current) return;
        pressed.current = false;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        const d = Math.hypot(dx, dy);
        const tap = isTouch.current ? PRINT_TAP_TOUCH_PX : PRINT_TAP_PX;
        const el = nodeRef.current;
        if (el) el.style.willChange = "auto";
        if (dragging.current || d >= tap) {
          const p = getPose(src);
          p.x = origin.current.x + dx;
          p.y = origin.current.y + dy;
          dragging.current = false;
          writeTransform(p.x, p.y);
          return;
        }
        dragging.current = false;
        writeTransform(origin.current.x, origin.current.y);
        onPrintTap(index);
      }}
      onPointerCancel={() => {
        pressed.current = false;
        dragging.current = false;
        scrollIntent.current = false;
        const p = getPose(src);
        writeTransform(p.x, p.y);
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
                ? "[filter:none]"
                : `${GOLDEN_FILTER} md:group-hover/still:[filter:none]`
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
