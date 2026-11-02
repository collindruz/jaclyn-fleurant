"use client";

import { motion } from "framer-motion";
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

  const reset = useCallback(() => {
    setActiveIndex(null);
    setEnlargedIndex(null);
  }, []);

  const onPrintTap = useCallback((i: number) => {
    setActiveIndex(i);
    setEnlargedIndex((cur) => (cur === i ? null : i));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (enlargedIndex != null) {
        setEnlargedIndex(null);
        return;
      }
      reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlargedIndex, reset]);

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
          viewW={board.w}
          onClose={closeEnlarge}
        />
      ) : null}
    </div>
  );
}

function WorldEnlarge({
  still,
  index,
  n,
  viewW,
  onClose,
}: {
  still: WorldStill;
  index: number;
  n: number;
  viewW: number;
  onClose: () => void;
}) {
  const natW = still.width > 32 ? still.width : 1600;
  const natH = still.height > 32 ? still.height : 2000;
  const vw = viewW > 0 ? viewW : 1280;
  const vh =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const aspect = natH / natW || 1.4;
  const displayW = Math.round(
    Math.min(
      2560,
      Math.max(natW, vw * 0.92, (vh * 1.18) / aspect)
    )
  );

  return (
    <div
      className="fixed inset-0 z-[2000000]"
      role="dialog"
      aria-modal="true"
      aria-label={`Still ${index + 1} of ${n}, enlarged`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-bone/80" />
      <button
        type="button"
        className="fixed right-3 top-3 z-20 cursor-pointer border-0 bg-bone/90 px-3 py-1.5 font-sans text-[0.62rem] tracking-[0.12em] text-charcoal/70 sm:right-5 sm:top-5"
        aria-label={`Close still ${index + 1} of ${n}`}
        onClick={onClose}
      >
        Close
      </button>
      <div
        className="absolute inset-0 z-10 overflow-auto overscroll-contain pt-12"
        style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="inline-block min-h-full min-w-full p-4 sm:p-6">
          <Image
            src={still.src}
            alt=""
            width={still.width}
            height={still.height}
            className="block h-auto max-w-none select-none"
            style={{ width: displayW }}
            sizes={`${displayW}px`}
            quality={90}
            priority
            draggable={false}
          />
        </div>
      </div>
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
      tabIndex={0}
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
