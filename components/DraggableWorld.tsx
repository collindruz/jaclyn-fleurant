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
          />
        );
      })}

      {enlarged && enlargedIndex != null ? (
        <div
          className="fixed inset-0 z-[2000000] flex items-center justify-center bg-bone/70 p-3 sm:p-5"
          onClick={closeEnlarge}
        >
          <button
            type="button"
            className="relative h-[min(82dvh,calc(100dvh-8rem))] w-[min(92vw,52rem)] max-h-full max-w-full cursor-pointer border-0 bg-transparent p-0"
            aria-label={`Close still ${enlargedIndex + 1} of ${n}`}
            onClick={closeEnlarge}
          >
            <Image
              src={enlarged.src}
              alt=""
              fill
              className="pointer-events-none object-contain object-center"
              sizes="(max-width: 767px) 92vw, (max-width: 1279px) 80vw, 52rem"
              quality={90}
              priority
              draggable={false}
            />
          </button>
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
  zIndex: number;
  isActive: boolean;
  isEnlarged: boolean;
  onActivate: () => void;
  onPrintTap: () => void;
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
}: DraggablePrintProps) {
  const { rotate } = useMemo(() => printVariant(src, index), [src, index]);
  const thumbSize = Math.max(24, Math.ceil(Math.max(slot.w, slot.h) * 2));
  const pointerStart = useRef({ x: 0, y: 0 });

  return (
    <motion.div
      className="absolute cursor-grab border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bone active:cursor-grabbing"
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
      drag
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
