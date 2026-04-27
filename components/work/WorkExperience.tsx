"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
 * md+ collapsed: several per view; md+ expanded (~1.5×): larger in-place archive read.
 */
/** md+ uses one slow size transition; mobile keeps a shorter transition for horizontal strip reflow. */
const stripItemClassBase =
  "group relative aspect-[4/5] shrink-0 overflow-hidden " +
  "w-[min(52vw,21rem)] min-w-[11rem] " +
  "transition-[width,max-width] duration-200 ease-out " +
  "md:duration-500 md:ease-in-out " +
  "motion-reduce:transition-none ";

const stripItemClassMd = "md:w-[24vw] md:min-w-0 md:max-w-[10.5rem] lg:max-w-[12rem]";

const stripItemClassMdExpanded =
  "md:w-[36vw] md:min-w-0 md:max-w-[16rem] lg:max-w-[18rem] md:transform-none";

function stripItemWidthClass(isMobile: boolean, isDesktopExpanded: boolean): string {
  if (isMobile) return stripItemClassBase;
  if (isDesktopExpanded) return stripItemClassBase + stripItemClassMdExpanded;
  return stripItemClassBase + stripItemClassMd;
}

/** Horizontal scroll: `w-0` + `overflow-visible` keeps group width to the image row; label sticks in scrollport. */
const COLOR_GROUP_STICKY_LABEL =
  "pointer-events-none sticky left-3 top-3 z-20 w-0 shrink-0 self-start overflow-visible " +
  "font-sans text-[0.5rem] font-normal leading-none uppercase tracking-[0.22em] text-charcoal/30 whitespace-nowrap";

/** Default hover nudge; avoid transform motion during md+ section expand (only width is animated). */
const liftClass =
  "relative h-full w-full origin-center transition duration-300 ease-out " +
  "will-change-transform " +
  "group-hover:-translate-y-[2.5px] group-hover:scale-[1.01] " +
  "motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100";

const liftClassNoHoverNudge = "relative h-full w-full origin-center";

const layoutSpring = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.78 };
const reducedT = { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const };

const FADED_WHEN_FOCUS = 0.2;

/** Mobile strip activation / tap-to-open — do not block vertical page scroll. */
const GAP_AXIS = 8;
const HORIZONTAL_BEAT = 10;
const TAP_MAX_PX = 20;
const TAP_MAX_MS = 800;

function isVerticalScrollIntent(dx: number, dy: number) {
  return Math.abs(dy) > Math.abs(dx) + GAP_AXIS;
}

function isHorizontalPanIntent(dx: number, dy: number) {
  return (
    Math.abs(dx) > HORIZONTAL_BEAT && Math.abs(dx) > Math.abs(dy) + GAP_AXIS
  );
}

function isLightTapGesture(dx: number, dy: number, dt: number) {
  return (
    Math.hypot(dx, dy) < TAP_MAX_PX && dt < TAP_MAX_MS
  );
}

/** Muted two-digit index (01–04) — tiny, not a graphic treatment. */
const workChapterIndexClass =
  "mb-1.5 block font-sans text-[0.5rem] font-normal tabular-nums leading-none " +
  "tracking-[0.08em] text-charcoal/28";

const workChapterTitleTextClass =
  "block font-serif text-[1.4rem] font-light leading-[1.2] tracking-[-0.01em] " +
  "text-charcoal/48 sm:text-[1.5rem] md:text-[1.65rem]";

/** Space after chapter block before the lookbook strip. */
const workChapterTitleGapClass = "mb-10 sm:mb-12 md:mb-10";

/** Vertical break between main sections (tighter on md+ only). */
const workSectionChapterBreakClass = "mt-20 sm:mt-28 md:mt-24";

type MobileImagePointerEnd = {
  dx: number;
  dy: number;
  dt: number;
  sectionKey: WorkSectionKey;
};

type StripItemProps = {
  item: WorkItem;
  groupLabel: string;
  capId: string;
  panelId: string;
  sectionKey: WorkSectionKey;
  isMobile: boolean;
  /** md+ only: this top-level section is expanded in place. */
  isDesktopExpanded: boolean;
  isFocused: boolean;
  isFaded: boolean;
  /** Mobile: strip is “armed” (horizontal or first tap) — second tap can open focus. */
  stripArmed: boolean;
  onMobileImagePointerEnd: (panelId: string, p: MobileImagePointerEnd) => void;
  reduceMotion: boolean;
};

function StripItem({
  item,
  groupLabel,
  capId,
  panelId,
  sectionKey,
  isMobile,
  isDesktopExpanded,
  isFocused,
  isFaded,
  stripArmed,
  onMobileImagePointerEnd,
  reduceMotion,
}: StripItemProps) {
  const mobilePtr = useRef<{
    x0: number;
    y0: number;
    t0: number;
    id: number;
  } | null>(null);
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

  const clearMobilePtr = useCallback(() => {
    mobilePtr.current = null;
  }, []);

  const handleMobilePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile || isFaded) return;
      mobilePtr.current = {
        x0: e.clientX,
        y0: e.clientY,
        t0: Date.now(),
        id: e.pointerId,
      };
    },
    [isFaded, isMobile]
  );

  const handleMobilePointerEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile || isFaded) return;
      const start = mobilePtr.current;
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x0;
      const dy = e.clientY - start.y0;
      const dt = Date.now() - start.t0;
      clearMobilePtr();
      onMobileImagePointerEnd(panelId, { dx, dy, dt, sectionKey });
    },
    [
      isFaded,
      isMobile,
      panelId,
      sectionKey,
      onMobileImagePointerEnd,
      clearMobilePtr,
    ]
  );

  const itemWidthClass = stripItemWidthClass(isMobile, isDesktopExpanded);
  const lift =
    !isMobile && isDesktopExpanded ? liftClassNoHoverNudge : liftClass;

  // Mobile: source slot while this item is shown in the focus layer
  if (isMobile && isFocused) {
    return <li className={itemWidthClass} aria-hidden />;
  }

  const mediaInner = (() => {
    if (item.kind === "video") {
      return (
        <div className={lift}>
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
      <div className={lift}>
        <div className="absolute inset-0 h-full w-full">
          <Image
            src={item.src}
            alt={imageAlt}
            fill
            sizes={
              isMobile
                ? "(max-width: 767px) 55vw, (max-width: 1024px) 20vw, 12vw"
                : isDesktopExpanded
                  ? "(max-width: 1023px) 32vw, (max-width: 1279px) 24vw, 20vw"
                  : "(max-width: 1024px) 20vw, 12vw"
            }
            className={mediaClass}
            draggable={false}
          />
        </div>
      </div>
    );
  })();

  // Desktop / tablet: static list item, no tap focus (stripArmed ignored)
  if (!isMobile) {
    return (
      <li
        className={itemWidthClass}
        role="listitem"
        data-work-panel={panelId}
        aria-describedby={showCaption ? capId : undefined}
      >
        <div
          className="relative h-full w-full cursor-pointer overflow-hidden"
          data-cursor="interactive"
        >
          {mediaInner}
        </div>
        {caption}
      </li>
    );
  }

  const mobileCursorClass =
    isFaded
      ? "cursor-default select-none"
      : stripArmed
        ? "cursor-pointer"
        : "cursor-default";

  // Mobile: motion; pointer gestures decide strip activation vs open (no click — avoids scroll fights)
  return (
    <motion.li
      layout={false}
      className={`${itemWidthClass} ${mobileCursorClass}`}
      role="listitem"
      data-work-panel={panelId}
      aria-describedby={showCaption && !isFocused ? capId : undefined}
      data-cursor={stripArmed && !isFaded ? "interactive" : undefined}
      initial={false}
      animate={{ opacity: isFaded ? FADED_WHEN_FOCUS : 1 }}
      transition={t}
      onPointerDown={handleMobilePointerDown}
      onPointerUp={handleMobilePointerEnd}
      onPointerCancel={clearMobilePtr}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        layout={false}
        layoutId={layoutId}
        className="relative h-full w-full overflow-hidden bg-transparent"
        transition={reduceMotion ? reducedT : { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
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
        layout={false}
        layoutId={layoutId}
        className="relative w-[min(90vw,92vw)] max-w-[min(92vw,calc(88dvh*0.8))] max-h-[88dvh] min-h-0 aspect-[4/5] cursor-pointer overflow-hidden bg-transparent"
        transition={reduceMotion ? reducedT : { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
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
  /** md+: this section is expanded in place (larger tiles). */
  isSectionDesktopExpanded: boolean;
  onDesktopStripExpand: () => void;
  stripArmed: boolean;
  onStripHorizontal: (sk: WorkSectionKey) => void;
  onMobileImagePointerEnd: (panelId: string, p: MobileImagePointerEnd) => void;
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
  isSectionDesktopExpanded,
  onDesktopStripExpand,
  stripArmed,
  onStripHorizontal,
  onMobileImagePointerEnd,
  reduceMotion,
}: SectionWorkScrollProps) {
  const hasFocus = Boolean(focusedPanelId) && isMobile;
  const listId = `${sectionKey}-work-scroll`;
  const hStripPtr = useRef<{
    x0: number;
    y0: number;
    id: number;
  } | null>(null);
  const desktopStripTapRef = useRef<{ x: number; y: number } | null>(null);

  const handleDesktopStripClick = useCallback(
    (e: React.MouseEvent<HTMLUListElement>) => {
      if (isMobile) return;
      const start = desktopStripTapRef.current;
      desktopStripTapRef.current = null;
      if (start) {
        const d = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (d > 20) return;
      }
      onDesktopStripExpand();
    },
    [isMobile, onDesktopStripExpand]
  );

  const handleHStripPointerDown = useCallback(
    (e: React.PointerEvent<HTMLUListElement>) => {
      if (!isMobile) {
        desktopStripTapRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      hStripPtr.current = {
        x0: e.clientX,
        y0: e.clientY,
        id: e.pointerId,
      };
    },
    [isMobile]
  );

  const handleHStripPointerMove = useCallback(
    (e: React.PointerEvent<HTMLUListElement>) => {
      if (!isMobile) return;
      const s = hStripPtr.current;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0;
      const dy = e.clientY - s.y0;
      if (isHorizontalPanIntent(dx, dy)) {
        onStripHorizontal(sectionKey);
      }
    },
    [isMobile, onStripHorizontal, sectionKey]
  );

  const clearHStripPtr = useCallback((e: React.PointerEvent<HTMLUListElement>) => {
    const s = hStripPtr.current;
    if (s && e.pointerId === s.id) hStripPtr.current = null;
  }, []);

  return (
    <section
      className="relative w-full"
      id={listId}
      aria-label={`${sectionLabel} work`}
    >
      <div className="mx-auto w-full max-w-[min(100%,1800px)] px-3 sm:px-5 md:px-7 lg:px-9">
        <div className="-mx-3 min-w-0 px-3 md:mx-0 md:px-0">
          <ul
            className="no-scrollbar m-0 flex list-none items-center gap-3.5 overflow-x-auto overscroll-x-contain scroll-auto p-0 pb-1.5 pl-1.5 pr-0 sm:gap-4 sm:pl-2 sm:pr-0 md:gap-4 md:pl-2.5"
            data-cursor={isMobile ? undefined : "interactive"}
            style={{
              WebkitOverflowScrolling: "touch",
              ...(isMobile ? { touchAction: "pan-x pan-y" } : null),
            }}
            onPointerDown={handleHStripPointerDown}
            onPointerMove={handleHStripPointerMove}
            onPointerUpCapture={clearHStripPtr}
            onPointerCancelCapture={clearHStripPtr}
            onClick={handleDesktopStripClick}
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
                    className="m-0 flex min-w-0 list-none items-center gap-3.5 p-0 sm:gap-4 md:gap-4"
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
                          sectionKey={sectionKey}
                          isMobile={isMobile}
                          isDesktopExpanded={isSectionDesktopExpanded}
                          isFocused={isFocused}
                          isFaded={isFaded}
                          stripArmed={stripArmed}
                          onMobileImagePointerEnd={onMobileImagePointerEnd}
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
  const isDesktop = !isMobile;
  const [expandedSection, setExpandedSection] = useState<WorkSectionKey | null>(
    null
  );
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const [stripReady, setStripReady] = useState<
    Partial<Record<WorkSectionKey, boolean>>
  >({});
  const stripReadyRef = useRef(stripReady);
  const expandedSectionContainerRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    stripReadyRef.current = stripReady;
  }, [stripReady]);

  const closeFocus = useCallback(() => {
    setFocusedPanelId(null);
    setStripReady({});
  }, []);

  const onStripHorizontal = useCallback((sk: WorkSectionKey) => {
    setStripReady((r) => ({ ...r, [sk]: true }));
  }, []);

  const onMobileImagePointerEnd = useCallback(
    (panelId: string, p: MobileImagePointerEnd) => {
      const { dx, dy, dt, sectionKey: sk } = p;
      if (isVerticalScrollIntent(dx, dy)) return;
      if (isHorizontalPanIntent(dx, dy)) return;
      if (!isLightTapGesture(dx, dy, dt)) return;
      if (!stripReadyRef.current[sk]) {
        setStripReady((r) => ({ ...r, [sk]: true }));
        return;
      }
      setFocusedPanelId(panelId);
    },
    []
  );

  useEffect(() => {
    if (!isMobile) closeFocus();
  }, [isMobile, closeFocus]);

  useEffect(() => {
    if (isMobile) setExpandedSection(null);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || expandedSection === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setExpandedSection(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMobile, expandedSection]);

  useEffect(() => {
    if (isMobile || expandedSection === null) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const el = expandedSectionContainerRef.current;
      if (!el) return;
      const t = e.target;
      if (t instanceof Node && el.contains(t)) return;
      setExpandedSection(null);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [isMobile, expandedSection]);

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
          const sectionNum =
            WORK_SECTION_ORDER.findIndex((s) => s.key === section.key) + 1;
          const sectionIndexLabel = String(sectionNum).padStart(2, "0");
          const isChExpanded = isDesktop && expandedSection === section.key;
          const onDesktopTitleToggle = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isMobile) return;
            setExpandedSection((prev) =>
              prev === section.key ? null : section.key
            );
          };
          const onDesktopTitleKeyDown = (e: React.KeyboardEvent) => {
            if (isMobile) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpandedSection((prev) =>
                prev === section.key ? null : section.key
              );
            }
          };
          const indexTitleClass =
            workChapterIndexClass +
            (isChExpanded
              ? " md:opacity-100 md:text-charcoal/40"
              : isDesktop
                ? " md:opacity-90"
                : "");
          const labelTitleClass =
            workChapterTitleTextClass +
            (isChExpanded
              ? " md:opacity-100 md:text-charcoal/62"
              : isDesktop
                ? " md:opacity-90"
                : "");
          return (
            <div
              key={section.key}
              ref={expandedSection === section.key ? expandedSectionContainerRef : null}
              className={showSectionRule ? workSectionChapterBreakClass : undefined}
            >
              <div className="mx-auto w-full max-w-[min(100%,1800px)] px-3 sm:px-5 md:px-7 lg:px-9">
                <h2
                  className={
                    `pl-0.5 pr-1 sm:pl-1 sm:pr-1 transition-[opacity] duration-300 ` +
                    workChapterTitleGapClass +
                    (isDesktop
                      ? " cursor-pointer select-none " +
                        " focus-visible:outline focus-visible:outline-1 " +
                        " focus-visible:outline-offset-[6px] focus-visible:outline-charcoal/20"
                      : "")
                  }
                  data-cursor={isDesktop ? "interactive" : undefined}
                  onClick={onDesktopTitleToggle}
                  onKeyDown={onDesktopTitleKeyDown}
                  tabIndex={isDesktop ? 0 : undefined}
                  aria-expanded={isDesktop ? isChExpanded : undefined}
                >
                  <span className={indexTitleClass}>
                    {sectionIndexLabel}
                  </span>
                  <span className={labelTitleClass}>
                    {section.label}
                  </span>
                </h2>
              </div>
              <SectionWorkScroll
                sectionKey={section.key}
                sectionLabel={section.label}
                focusedPanelId={focusedPanelId}
                isMobile={isMobile}
                isSectionDesktopExpanded={isChExpanded}
                onDesktopStripExpand={() => setExpandedSection(section.key)}
                stripArmed={Boolean(stripReady[section.key])}
                onStripHorizontal={onStripHorizontal}
                onMobileImagePointerEnd={onMobileImagePointerEnd}
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
