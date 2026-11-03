"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** #2C2A27 at ~55% — thin stroke default. */
const CURSOR_COLOR = "rgba(44, 42, 39, 0.55)";

/** Near-black fill + stroke on interactive hit targets. */
const INTERACTIVE_COLOR = "rgba(14, 13, 12, 0.96)";

const FILL_STROKE_TRANSITION = "fill 0.2s ease, stroke 0.2s ease";
const INTERACTIVE_COLOR_TRANSITION = "color 0.2s ease";

/** Small nudge; star “center” uses CURSOR_XFORM_TAIL. */
const OFFSET = { x: 4, y: 4 };

/** Main and ghost both chase `target` (raw pointer); higher = snappier. */
const MAIN_LERP = 0.2;
/** Slower = ghost lags further behind the main during motion. */
const GHOST_LERP = 0.08;

const CURSOR_XFORM_TAIL = "translate(-11px, -11px)";

const GHOST_SCALE = 0.7;

const GHOST_OPACITY_IDLE = 0.25;
const GHOST_OPACITY_HOVER = 0.35;

const FINE_POINTER_MQ = "(hover: hover) and (pointer: fine)";
const IDLE_EPS = 0.18;

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], [data-cursor="interactive"]';

const CURSOR_LAYER = 500000 as const;

function subscribeFinePointer(onChange: () => void) {
  const mq = window.matchMedia(FINE_POINTER_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getFinePointerSnapshot() {
  return window.matchMedia(FINE_POINTER_MQ).matches;
}

function getFinePointerServerSnapshot() {
  return false;
}

const STAR_PATH =
  "M11 3 L12.3 9.2 L18.7 11.1 L12.4 13.2 L11.2 18.8 L9.6 13.1 L3.2 10.9 L9.7 8.8 Z";

function GhostStarSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path
        d={STAR_PATH}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="0.65"
      />
    </svg>
  );
}

function MainStarPath({ isInteractive }: { isInteractive: boolean }) {
  return (
    <path
      d={STAR_PATH}
      fill={isInteractive ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="0.65"
      style={{ transition: FILL_STROKE_TRANSITION }}
    />
  );
}

function MainStarSvg({ isInteractive }: { isInteractive: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <MainStarPath isInteractive={isInteractive} />
    </svg>
  );
}

const layerBase = {
  position: "fixed" as const,
  left: 0,
  top: 0,
  pointerEvents: "none" as const,
  zIndex: CURSOR_LAYER,
  mixBlendMode: "normal" as const,
  color: CURSOR_COLOR,
};

function ArtCursor() {
  const [hydrated, setHydrated] = useState(false);
  const finePointer = useSyncExternalStore(
    subscribeFinePointer,
    getFinePointerSnapshot,
    getFinePointerServerSnapshot
  );
  const useCustom = hydrated && finePointer;
  const [active, setActive] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);

  useLayoutEffect(() => {
    setHydrated(true);
  }, []);

  const target = useRef({ x: 0, y: 0 });
  const mainX = useRef(0);
  const mainY = useRef(0);
  const ghostX = useRef(0);
  const ghostY = useRef(0);
  const mainNode = useRef<HTMLDivElement>(null);
  const ghostNode = useRef<HTMLDivElement>(null);
  const rafId = useRef(0);
  const looping = useRef(false);

  const setMainTransform = (cx: number, cy: number) => {
    if (!mainNode.current) return;
    mainNode.current.style.transform = `translate3d(${
      cx + OFFSET.x
    }px, ${cy + OFFSET.y}px, 0) ${CURSOR_XFORM_TAIL}`;
  };

  const setGhostTransform = (gx: number, gy: number) => {
    if (!ghostNode.current) return;
    ghostNode.current.style.transform = `translate3d(${
      gx + OFFSET.x
    }px, ${gy + OFFSET.y}px, 0) ${CURSOR_XFORM_TAIL} scale(${GHOST_SCALE})`;
  };

  useEffect(() => {
    if (!useCustom) return;
    const onOver = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest(INTERACTIVE_SELECTOR)) setIsInteractive(true);
    };
    const onOut = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const r = e.relatedTarget;
      if (r && r instanceof Element && r.closest(INTERACTIVE_SELECTOR)) {
        return;
      }
      const from = e.target.closest(INTERACTIVE_SELECTOR);
      if (!from) return;
      if (r instanceof Node && from.contains(r)) return;
      setIsInteractive(false);
    };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, [useCustom]);

  useEffect(() => {
    if (!useCustom) return;
    const onMove = (e: MouseEvent) => {
      const p = { x: e.clientX, y: e.clientY };
      if (!active) {
        setActive(true);
        target.current = p;
        mainX.current = p.x;
        mainY.current = p.y;
        ghostX.current = p.x;
        ghostY.current = p.y;
        setMainTransform(p.x, p.y);
        setGhostTransform(p.x, p.y);
        return;
      }
      target.current = p;
      if (!looping.current) {
        looping.current = true;
        rafId.current = requestAnimationFrame(step);
      }
    };
    const step = () => {
      const tx = target.current.x;
      const ty = target.current.y;
      const mx = mainX.current;
      const my = mainY.current;
      mainX.current = mx + (tx - mx) * MAIN_LERP;
      mainY.current = my + (ty - my) * MAIN_LERP;

      const gx = ghostX.current;
      const gy = ghostY.current;
      ghostX.current = gx + (tx - gx) * GHOST_LERP;
      ghostY.current = gy + (ty - gy) * GHOST_LERP;

      setMainTransform(mainX.current, mainY.current);
      setGhostTransform(ghostX.current, ghostY.current);

      const settled =
        Math.hypot(tx - mainX.current, ty - mainY.current) < IDLE_EPS &&
        Math.hypot(tx - ghostX.current, ty - ghostY.current) < IDLE_EPS;
      if (settled) {
        looping.current = false;
        return;
      }
      rafId.current = requestAnimationFrame(step);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId.current);
      looping.current = false;
    };
  }, [active, useCustom]);

  if (!useCustom) {
    return null;
  }

  const ghostOpacity = isInteractive ? GHOST_OPACITY_HOVER : GHOST_OPACITY_IDLE;

  return (
    <>
      <div
        ref={ghostNode}
        className="pointer-events-none"
        style={{
          ...layerBase,
          transform: `translate3d(0, 0, 0) ${CURSOR_XFORM_TAIL} scale(${GHOST_SCALE})`,
          opacity: active ? ghostOpacity : 0,
          transition: "opacity 0.2s ease-out",
        }}
        aria-hidden
      >
        <div className="art-cursor-wobble">
          <GhostStarSvg />
        </div>
      </div>
      <div
        ref={mainNode}
        className="pointer-events-none"
        style={{
          ...layerBase,
          color: isInteractive ? INTERACTIVE_COLOR : CURSOR_COLOR,
          transform: `translate3d(0, 0, 0) ${CURSOR_XFORM_TAIL}`,
          opacity: active ? 1 : 0,
          transition: `opacity 0.12s ease-out, ${INTERACTIVE_COLOR_TRANSITION}`,
        }}
        aria-hidden
      >
        <div className="art-cursor-wobble">
          <MainStarSvg isInteractive={isInteractive} />
        </div>
      </div>
    </>
  );
}

export default ArtCursor;
export { ArtCursor };
