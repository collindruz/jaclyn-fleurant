"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { workAssets, WORK_COLOR_ORDER, type WorkItem } from "@/lib/placeholders";

const MOBILE_MQ = "(max-width: 767px)";

function subscribeMobile(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getMobileSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;
}

function getServerMobileSnapshot() {
  return false;
}

function workFocusLayoutId(panelId: string) {
  return `work-focus-${panelId}`;
}

function resolveWorkItem(
  panelId: string
): { item: WorkItem; groupLabel: string } | null {
  for (const group of WORK_COLOR_ORDER) {
    const prefix = `${group.key}-`;
    if (!panelId.startsWith(prefix)) continue;
    const rest = panelId.slice(prefix.length);
    const i = parseInt(rest, 10);
    if (Number.isNaN(i)) continue;
    const items = workAssets[group.key];
    if (items[i]) return { item: items[i], groupLabel: group.label };
  }
  return null;
}

/**
 * 4:5 stills, horizontal strip.
 * Mobile: larger cards (~1.5–2 per viewport).
 * md+: several per view, consistent editorial sizing.
 */
const stripItemClass =
  "group relative aspect-[4/5] shrink-0 overflow-hidden " +
  "w-[min(52vw,21rem)] min-w-[11rem] " +
  "md:w-[24vw] md:min-w-0 md:max-w-[10.5rem] lg:max-w-[12rem]";

const liftClass =
  "relative h-full w-full origin-center transition duration-300 ease-out " +
  "will-change-transform " +
  "group-hover:-translate-y-[2.5px] group-hover:scale-[1.01] " +
  "motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100";

const layoutSpring = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.78 };
const reducedT = { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const };

const FADED_WHEN_FOCUS = 0.2;

type StripItemProps = {
  item: WorkItem;
  groupLabel: string;
  capId: string;
  panelId: string;
  isMobile: boolean;
  isFocused: boolean;
  isFaded: boolean;
  onMobileTap: (panelId: string) => void;
  reduceMotion: boolean;
};

function StripItem({
  item,
  groupLabel,
  capId,
  panelId,
  isMobile,
  isFocused,
  isFaded,
  onMobileTap,
  reduceMotion,
}: StripItemProps) {
  const showCaption = Boolean(item.caption);
  const imageAlt = item.caption || `${groupLabel} photograph`;
  const mediaClass = "absolute inset-0 h-full w-full object-cover object-center";
  const layoutId = workFocusLayoutId(panelId);
  const t = reduceMotion ? reducedT : layoutSpring;

  const caption = showCaption && !isFocused && (
    <p
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] px-2.5 pb-2 pt-6 font-sans text-[0.5rem] leading-relaxed tracking-[0.12em] text-charcoal/38 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 motion-reduce:group-hover:opacity-0"
      id={capId}
    >
      {item.caption}
    </p>
  );

  const handleClick = (e: React.MouseEvent) => {
    if (!isMobile) return;
    if (isFaded) return;
    e.stopPropagation();
    onMobileTap(panelId);
  };

  // Mobile: source slot while this item is shown in the focus layer
  if (isMobile && isFocused) {
    return <li className={stripItemClass} aria-hidden />;
  }

  const mediaInner = (() => {
    if (item.kind === "video") {
      return (
        <div className={liftClass}>
          <div className="absolute inset-0 h-full w-full">
            <video
              className={mediaClass}
              src={item.src}
              muted
              loop
              playsInline
              autoPlay
              title={item.caption || `${groupLabel} video`}
            />
          </div>
        </div>
      );
    }
    return (
      <div className={liftClass}>
        <div className="absolute inset-0 h-full w-full">
          <Image
            src={item.src}
            alt={imageAlt}
            fill
            sizes="(max-width: 767px) 55vw, (max-width: 1024px) 20vw, 12vw"
            className={mediaClass}
            draggable={false}
          />
        </div>
      </div>
    );
  })();

  // Desktop / tablet: static list item, no tap focus
  if (!isMobile) {
    return (
      <li
        className={stripItemClass}
        role="listitem"
        aria-describedby={showCaption ? capId : undefined}
      >
        {mediaInner}
        {caption}
      </li>
    );
  }

  // Mobile: motion + optional fade; tap to focus (not when faded)
  return (
    <motion.li
      layout={false}
      className={`${stripItemClass} ${isFaded ? "cursor-default select-none" : "cursor-pointer"}`}
      role="listitem"
      aria-describedby={showCaption && !isFocused ? capId : undefined}
      initial={false}
      animate={{ opacity: isFaded ? FADED_WHEN_FOCUS : 1 }}
      transition={t}
      onClick={handleClick}
    >
      <motion.div
        layout
        layoutId={layoutId}
        className="relative h-full w-full overflow-hidden bg-transparent"
        transition={reduceMotion ? reducedT : { ...layoutSpring, layout: layoutSpring }}
      >
        {mediaInner}
      </motion.div>
      {caption}
    </motion.li>
  );
}

type MobileFocusLayerProps = {
  panelId: string;
  item: WorkItem;
  groupLabel: string;
  reduceMotion: boolean;
};

/**
 * Full-bleed hit target (no scrim). Close via section wrapper onClick. layoutId pairs with strip.
 */
function MobileFocusLayer({
  panelId,
  item,
  groupLabel,
  reduceMotion,
}: MobileFocusLayerProps) {
  const layoutId = workFocusLayoutId(panelId);
  const t = reduceMotion ? reducedT : layoutSpring;
  const imageAlt = item.caption || `${groupLabel} photograph`;
  const title = item.caption || `${groupLabel} ${item.kind === "video" ? "video" : "image"}`;

  return (
    <motion.div
      className="pointer-events-auto fixed left-0 top-0 z-[200] h-[100dvh] w-full flex items-center justify-center p-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={t}
    >
      <motion.div
        layout
        layoutId={layoutId}
        className="relative w-[min(90vw,92vw)] max-w-[min(92vw,calc(88dvh*0.8))] max-h-[88dvh] min-h-0 aspect-[4/5] cursor-pointer overflow-hidden bg-transparent"
        transition={reduceMotion ? reducedT : { ...layoutSpring, layout: layoutSpring }}
        data-cursor="interactive"
      >
        {item.kind === "video" ? (
          <video
            className="absolute inset-0 h-full w-full object-cover object-center"
            src={item.src}
            muted
            loop
            playsInline
            autoPlay
            title={title}
          />
        ) : (
          <Image
            src={item.src}
            alt={imageAlt}
            fill
            sizes="100vw"
            className="object-cover object-center"
            priority
            draggable={false}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

function ColorStrip({
  groupKey,
  label,
  items,
  isFirst,
  focusedPanelId,
  isMobile,
  onMobileTap,
  reduceMotion,
}: {
  groupKey: string;
  label: string;
  items: WorkItem[];
  isFirst: boolean;
  focusedPanelId: string | null;
  isMobile: boolean;
  onMobileTap: (panelId: string) => void;
  reduceMotion: boolean;
}) {
  const hasFocus = Boolean(focusedPanelId) && isMobile;
  const regionLabel = `${label} — work`;

  return (
    <section
      className={
        "relative w-full " +
        (isFirst
          ? "border-0"
          : "border-t border-charcoal/[0.05] " + "pt-12 sm:pt-14 md:pt-18")
      }
      id={groupKey}
      aria-labelledby={`${groupKey}-heading`}
    >
      <div className="mx-auto w-full max-w-[min(100%,1800px)] px-3 sm:px-5 md:px-7 lg:px-9">
        {items.length === 0 ? (
          <p className="pb-5 font-sans text-[0.65rem] leading-relaxed tracking-[0.05em] text-charcoal/25 sm:pb-6">
            Add image or video paths for this color group in{" "}
            <span className="whitespace-nowrap text-charcoal/40">lib/placeholders.ts</span>
          </p>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6 lg:gap-8">
            <h2
              id={`${groupKey}-heading`}
              className="shrink-0 font-sans text-[0.52rem] font-normal leading-snug tracking-[0.22em] text-charcoal/30 md:w-24 md:pt-0.5 md:leading-tight lg:w-28"
            >
              {label}
            </h2>
            <div className="min-w-0 flex-1 -mx-3 px-3 md:mx-0 md:px-0">
              <ul
                role="list"
                aria-label={regionLabel}
                className="no-scrollbar flex touch-pan-x gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-1.5 pr-0 sm:gap-5 sm:pr-0 md:gap-5"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {items.map((item, i) => {
                  const capId = `${groupKey}-cap-${i}`;
                  const panelId = `${groupKey}-${i}`;
                  const isFocused = focusedPanelId === panelId;
                  const isFaded = hasFocus && !isFocused;
                  return (
                    <StripItem
                      key={`${groupKey}-${i}-${item.src}`}
                      item={item}
                      groupLabel={label}
                      capId={capId}
                      panelId={panelId}
                      isMobile={isMobile}
                      isFocused={isFocused}
                      isFaded={isFaded}
                      onMobileTap={onMobileTap}
                      reduceMotion={reduceMotion}
                    />
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function WorkExperience() {
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getServerMobileSnapshot
  );
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  const closeFocus = useCallback(() => {
    setFocusedPanelId(null);
  }, []);

  /** Opens focus from a strip item (non-faded only; wrapper/overlay handle close). */
  const onMobileTap = useCallback((panelId: string) => {
    setFocusedPanelId(panelId);
  }, []);

  useEffect(() => {
    if (!isMobile) closeFocus();
  }, [isMobile, closeFocus]);

  useEffect(() => {
    if (!isMobile || focusedPanelId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFocus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMobile, focusedPanelId, closeFocus]);

  const resolved = focusedPanelId ? resolveWorkItem(focusedPanelId) : null;

  return (
    <LayoutGroup>
      <div
        className="relative w-full"
        onClick={() => {
          if (isMobile && focusedPanelId !== null) closeFocus();
        }}
      >
        {WORK_COLOR_ORDER.map((group, i) => {
          const items = workAssets[group.key];
          return (
            <ColorStrip
              key={group.key}
              groupKey={group.key}
              label={group.label}
              items={items}
              isFirst={i === 0}
              focusedPanelId={focusedPanelId}
              isMobile={isMobile}
              onMobileTap={onMobileTap}
              reduceMotion={reduceMotion}
            />
          );
        })}

        {isMobile && (
          <AnimatePresence>
            {resolved && focusedPanelId && (
              <MobileFocusLayer
                key={focusedPanelId}
                panelId={focusedPanelId}
                item={resolved.item}
                groupLabel={resolved.groupLabel}
                reduceMotion={reduceMotion}
              />
            )}
          </AnimatePresence>
        )}
      </div>
    </LayoutGroup>
  );
}
