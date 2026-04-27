"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  workSections,
  WORK_COLOR_ORDER,
  WORK_SECTION_ORDER,
  type WorkItem,
} from "@/lib/placeholders";
import type { WorkColorKey, WorkSectionKey } from "@/lib/work-types";

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

/**
 * `panelId` = `{sectionKey}-{colorKey}-{index}` (e.g. `editorial-black-0`).
 * Section and color keys are unambiguous (fixed vocab).
 */
const PANEL_RE =
  /^(editorial|redCarpet|advertising|costumeDesign)-(black|white|neutral|warm|cool|vivid)-(\d+)$/;

function getColorGroupLabel(key: WorkColorKey): string {
  const g = WORK_COLOR_ORDER.find((x) => x.key === key);
  return g?.label ?? key;
}

function parseWorkPanelId(panelId: string): {
  sectionKey: WorkSectionKey;
  colorKey: WorkColorKey;
  index: number;
} | null {
  const m = panelId.match(PANEL_RE);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) {
    return null;
  }
  return {
    sectionKey: m[1] as WorkSectionKey,
    colorKey: m[2] as WorkColorKey,
    index: parseInt(m[3], 10),
  };
}

function resolveWorkItem(
  panelId: string
): { item: WorkItem; groupLabel: string } | null {
  const parsed = parseWorkPanelId(panelId);
  if (!parsed) return null;
  const { sectionKey, colorKey, index } = parsed;
  if (Number.isNaN(index) || index < 0) return null;
  const item = workSections[sectionKey][colorKey][index];
  if (!item) return null;
  return { item, groupLabel: getColorGroupLabel(colorKey) };
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

/** Horizontal scroll: `w-0` + `overflow-visible` keeps group width to the image row; label sticks in scrollport. */
const COLOR_GROUP_STICKY_LABEL =
  "pointer-events-none sticky left-3 top-3 z-20 w-0 shrink-0 self-start overflow-visible " +
  "font-sans text-[0.5rem] font-normal leading-none uppercase tracking-[0.22em] text-charcoal/30 whitespace-nowrap";

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
        <div className="relative h-full w-full overflow-hidden">
          {mediaInner}
        </div>
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

function sectionHasItems(sectionKey: WorkSectionKey): boolean {
  return WORK_COLOR_ORDER.some(
    (c) => workSections[sectionKey][c.key].length > 0
  );
}

/** `true` if a section with content appears before this one in `WORK_SECTION_ORDER` (for spacing). */
function sectionNeedsTopSpacer(key: WorkSectionKey): boolean {
  for (const s of WORK_SECTION_ORDER) {
    if (s.key === key) return false;
    if (sectionHasItems(s.key)) return true;
  }
  return false;
}

type SectionWorkScrollProps = {
  sectionKey: WorkSectionKey;
  sectionLabel: string;
  focusedPanelId: string | null;
  isMobile: boolean;
  onMobileTap: (panelId: string) => void;
  reduceMotion: boolean;
};

/**
 * One horizontal scroller per section. Each color group is an `li` with real width = its image row;
 * a sticky top-left label sits in that segment so it stays visible for the full group, then the next
 * group’s label takes over as it reaches the left edge.
 */
function SectionWorkScroll({
  sectionKey,
  sectionLabel,
  focusedPanelId,
  isMobile,
  onMobileTap,
  reduceMotion,
}: SectionWorkScrollProps) {
  const hasFocus = Boolean(focusedPanelId) && isMobile;
  const listId = `${sectionKey}-work-scroll`;
  return (
    <section
      className="relative w-full"
      id={listId}
      aria-label={`${sectionLabel} work`}
    >
      <div className="mx-auto w-full max-w-[min(100%,1800px)] px-3 sm:px-5 md:px-7 lg:px-9">
        <div className="-mx-3 min-w-0 px-3 md:mx-0 md:px-0">
          <ul
            className="no-scrollbar m-0 flex list-none touch-pan-x items-center gap-4 overflow-x-auto overscroll-x-contain scroll-smooth p-0 pb-1.5 pr-0 sm:gap-5 sm:pr-0 md:gap-5"
            style={{ WebkitOverflowScrolling: "touch" }}
            aria-label={`${sectionLabel} — all color groups`}
          >
            {WORK_COLOR_ORDER.flatMap((group) => {
              const items = workSections[sectionKey][group.key];
              if (items.length === 0) return [];
              return [
                <li
                  key={`${sectionKey}-color-group-${group.key}`}
                  className="flex min-w-0 shrink-0 list-none"
                >
                  <span
                    className={COLOR_GROUP_STICKY_LABEL}
                    aria-hidden
                  >
                    {group.label}
                  </span>
                  <ul
                    className="m-0 flex min-w-0 list-none items-center gap-4 p-0 sm:gap-5 md:gap-5"
                    role="list"
                    aria-label={group.label}
                  >
                    {items.map((item, i) => {
                      const capId = `${sectionKey}-${group.key}-cap-${i}`;
                      const panelId = `${sectionKey}-${group.key}-${i}`;
                      const isFocused = focusedPanelId === panelId;
                      const isFaded = hasFocus && !isFocused;
                      return (
                        <StripItem
                          key={`${sectionKey}-${group.key}-${i}-${item.src}`}
                          item={item}
                          groupLabel={group.label}
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
                </li>,
              ];
            })}
          </ul>
        </div>
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
        {WORK_SECTION_ORDER.map((section) => {
          if (!sectionHasItems(section.key)) return null;
          const showSectionRule = sectionNeedsTopSpacer(section.key);
          return (
            <div
              key={section.key}
              className={
                showSectionRule
                  ? "mt-16 border-t border-charcoal/[0.05] pt-10 sm:mt-20 sm:pt-12 md:mt-24 md:pt-14"
                  : undefined
              }
            >
              <div className="mx-auto w-full max-w-[min(100%,1800px)] px-3 sm:px-5 md:px-7 lg:px-9">
                <h2 className="mb-8 font-serif text-[1.15rem] font-light leading-snug text-charcoal/70 sm:mb-10 sm:text-[1.2rem] md:text-[1.35rem]">
                  {section.label}
                </h2>
              </div>
              <SectionWorkScroll
                sectionKey={section.key}
                sectionLabel={section.label}
                focusedPanelId={focusedPanelId}
                isMobile={isMobile}
                onMobileTap={onMobileTap}
                reduceMotion={reduceMotion}
              />
            </div>
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
