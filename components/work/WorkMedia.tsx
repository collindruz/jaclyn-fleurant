"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkItem } from "@/lib/work-types";

function pauseOtherWorkVideos(keep: HTMLVideoElement | null) {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLVideoElement>("video[data-work-video]").forEach((el) => {
    if (el !== keep && !el.paused) el.pause();
  });
}

/** After click-to-load, native chrome (seek, volume, fullscreen) must stay on. */
function embedPlayerSrc(embedUrl: string, provider: "youtube" | "vimeo"): string {
  const url = new URL(embedUrl);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("controls", "1");
  url.searchParams.set("playsinline", "1");
  if (provider === "youtube") {
    if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
      url.hostname = "www.youtube-nocookie.com";
    }
    url.searchParams.set("mute", "0");
    url.searchParams.set("fs", "1");
    url.searchParams.set("rel", "0");
    url.searchParams.set("modestbranding", "1");
    url.searchParams.set("disablekb", "0");
    url.searchParams.set("iv_load_policy", "3");
  } else {
    url.searchParams.set("muted", "0");
    url.searchParams.set("fullscreen", "1");
    url.searchParams.set("keyboard", "1");
    url.searchParams.set("background", "0");
  }
  return url.toString();
}

function stopPlayerGesture(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export function itemAspect(item: WorkItem): { w: number; h: number } {
  const w = item.width && item.width > 0 ? item.width : 4;
  const h = item.height && item.height > 0 ? item.height : 5;
  return { w, h };
}

/** Closed-tile poster box. Uses the poster’s measured size when known. */
export function posterAspect(item: WorkItem): { w: number; h: number } {
  if (item.posterWidth && item.posterWidth > 0 && item.posterHeight && item.posterHeight > 0) {
    return { w: item.posterWidth, h: item.posterHeight };
  }
  return itemAspect(item);
}

function WorkPoster({
  poster,
  className,
}: {
  poster?: string;
  sizes?: string;
  priority?: boolean;
  className: string;
}) {
  if (!poster) {
    return <div className="h-full w-full bg-charcoal/10" />;
  }
  return (
    // Native img avoids next/image hydration mismatches on YouTube/Vimeo posters.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster}
      alt=""
      className={`${className} pointer-events-none absolute inset-0 h-full w-full object-contain object-center`}
      decoding="async"
      draggable={false}
    />
  );
}

export function WorkLocalVideo({
  src,
  title,
  poster,
  className,
  onDesktopActivate,
  sizes = "(max-width: 1023px) 50vw, 36vw",
  priority = false,
}: {
  src: string;
  title: string;
  poster?: string;
  posterWidth?: number;
  posterHeight?: number;
  className: string;
  onDesktopActivate?: () => void;
  sizes?: string;
  priority?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);

  const start = useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
      if ("preventDefault" in e) e.preventDefault();
      onDesktopActivate?.();
      setActive(true);
    },
    [onDesktopActivate]
  );

  useEffect(() => {
    if (!active) return;
    const v = ref.current;
    if (!v) return;
    pauseOtherWorkVideos(v);
    const play = () => {
      v.muted = false;
      return v.play().catch(() => {
        v.muted = true;
        return v.play();
      });
    };
    if (v.readyState >= 2) {
      void play();
      return;
    }
    const onReady = () => {
      void play();
    };
    v.addEventListener("loadeddata", onReady, { once: true });
    return () => v.removeEventListener("loadeddata", onReady);
  }, [active]);

  if (!active) {
    return (
      <div
        className="relative h-full w-full"
        onClick={start}
        onPointerDown={stopPlayerGesture}
        onPointerUp={stopPlayerGesture}
        role="button"
        tabIndex={0}
        aria-label={`Play ${title}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            start(e);
          }
        }}
      >
        <WorkPoster poster={poster} sizes={sizes} priority={priority} className={className} />
        <PlayMark />
      </div>
    );
  }

  return (
    <div
      data-work-player=""
      className="relative z-10 h-full w-full bg-charcoal/10"
      style={{ touchAction: "auto" }}
      onPointerDown={stopPlayerGesture}
      onPointerMove={stopPlayerGesture}
      onPointerUp={stopPlayerGesture}
      onPointerCancel={stopPlayerGesture}
      onClick={stopPlayerGesture}
      onTouchStart={stopPlayerGesture}
      onTouchMove={stopPlayerGesture}
    >
      <video
        ref={ref}
        data-work-video=""
        className={`${className} pointer-events-auto relative z-10 object-contain object-center`}
        src={src}
        poster={poster}
        playsInline
        controls
        preload="metadata"
        title={title}
        onPlay={(e) => pauseOtherWorkVideos(e.currentTarget)}
      />
    </div>
  );
}

export function WorkExternalVideo({
  item,
  className,
  onDesktopActivate,
  sizes = "(max-width: 1023px) 50vw, 36vw",
  priority = false,
}: {
  item: WorkItem;
  className: string;
  onDesktopActivate?: () => void;
  sizes?: string;
  priority?: boolean;
}) {
  const ext = item.external;
  const [open, setOpen] = useState(false);
  if (!ext) return null;

  const label = ext.title || "Video";
  const poster = item.poster;

  if (open && ext.embeddable && ext.embedUrl) {
    const src = embedPlayerSrc(ext.embedUrl, ext.provider);
    return (
      <div
        data-work-player=""
        className="relative z-10 h-full w-full bg-charcoal/10"
        style={{ touchAction: "auto" }}
        onPointerDown={stopPlayerGesture}
        onPointerMove={stopPlayerGesture}
        onPointerUp={stopPlayerGesture}
        onPointerCancel={stopPlayerGesture}
        onClick={stopPlayerGesture}
        onTouchStart={stopPlayerGesture}
        onTouchMove={stopPlayerGesture}
      >
        <iframe
          className="pointer-events-auto absolute inset-0 z-10 h-full w-full border-0"
          src={src}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  const activate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDesktopActivate?.();
    if (ext.embeddable && ext.embedUrl) {
      setOpen(true);
      return;
    }
    window.open(ext.watchUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="relative h-full w-full"
      onClick={activate}
      onPointerDown={stopPlayerGesture}
      onPointerUp={stopPlayerGesture}
      role="button"
      tabIndex={0}
      aria-label={
        ext.embeddable ? `Play ${label}` : `Watch ${label} on ${ext.provider}`
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(e as unknown as React.MouseEvent);
        }
      }}
    >
      <WorkPoster poster={poster} sizes={sizes} priority={priority} className={className} />
      <PlayMark />
      {!ext.embeddable ? (
        <span className="pointer-events-none absolute bottom-2 left-2 right-2 text-center font-sans text-[0.55rem] uppercase tracking-[0.14em] text-bone">
          Watch on {ext.provider === "vimeo" ? "Vimeo" : "YouTube"}
        </span>
      ) : null}
    </div>
  );
}

function PlayMark() {
  return (
    <span
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal/45 shadow-sm">
        <span className="ml-0.5 block h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-bone" />
      </span>
    </span>
  );
}
