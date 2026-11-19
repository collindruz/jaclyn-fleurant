"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WORK_SECTION_ORDER, type WorkSectionKey } from "@/lib/work-types";
import {
  layoutFromEditorState,
  type AdminInventory,
  type AdminPhoto,
  type AdminProject,
} from "@/lib/work-layout";

type Props = { inventory: AdminInventory };

type DragState = {
  src: string;
  fromProjectId: string;
};

function cloneProjects(projects: AdminProject[]): AdminProject[] {
  return projects.map((p) => ({ ...p, assets: [...p.assets] }));
}

function photoThumb(photo: AdminPhoto): string {
  if (photo.kind === "video") return photo.poster || photo.src;
  return photo.src;
}

function snapshotState(projects: AdminProject[], hidden: string[]) {
  return JSON.stringify({
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      sectionKey: p.sectionKey,
      assets: p.assets,
    })),
    hidden,
  });
}

export function AdminEditor({ inventory }: Props) {
  const [projects, setProjects] = useState(() => cloneProjects(inventory.projects));
  const [hidden, setHidden] = useState(() => [...inventory.hidden]);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshotState(inventory.projects, inventory.hidden)
  );
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [sectionFilter, setSectionFilter] = useState<WorkSectionKey | "all">(
    "all"
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const photosBySrc = useMemo(() => {
    const map = new Map<string, AdminPhoto>();
    for (const photo of inventory.photos) map.set(photo.src, photo);
    return map;
  }, [inventory.photos]);

  useEffect(() => {
    document.documentElement.classList.add("admin-editor");
    return () => document.documentElement.classList.remove("admin-editor");
  }, []);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  const visibleCount = useMemo(() => {
    let n = 0;
    for (const p of projects) {
      n += p.assets.filter((src) => {
        const photo = photosBySrc.get(src);
        return photo && !hiddenSet.has(photo.filename);
      }).length;
    }
    return n;
  }, [projects, photosBySrc, hiddenSet]);

  const hiddenPhotos = useMemo(() => {
    return inventory.photos.filter((p) => hiddenSet.has(p.filename));
  }, [inventory.photos, hiddenSet]);

  const layoutPayload = useCallback(() => {
    return layoutFromEditorState({ projects, hidden });
  }, [projects, hidden]);

  const unsaved = snapshotState(projects, hidden) !== savedSnapshot;

  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  const saveChanges = useCallback(async () => {
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/work-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layoutPayload()),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Save failed (${res.status})`);
      }
      setSavedSnapshot(snapshotState(projects, hidden));
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    }
  }, [hidden, layoutPayload, projects]);

  const resetChanges = useCallback(() => {
    if (!unsaved) return;
    const ok = window.confirm(
      "Discard unsaved edits and restore the last saved layout?"
    );
    if (!ok) return;
    const parsed = JSON.parse(savedSnapshot) as {
      projects: AdminProject[];
      hidden: string[];
    };
    setProjects(cloneProjects(parsed.projects));
    setHidden([...parsed.hidden]);
    setSaveState("idle");
    setSaveError(null);
  }, [savedSnapshot, unsaved]);

  const movePhoto = useCallback(
    (src: string, destProjectId: string, destIndex: number) => {
      setProjects((prev) => {
        const next = cloneProjects(prev);
        let moving: string | null = null;
        for (const p of next) {
          const i = p.assets.indexOf(src);
          if (i !== -1) {
            moving = p.assets.splice(i, 1)[0] ?? null;
            break;
          }
        }
        if (!moving) moving = src;
        const dest = next.find((p) => p.id === destProjectId);
        if (!dest) return prev;
        const idx = Math.max(0, Math.min(destIndex, dest.assets.length));
        dest.assets.splice(idx, 0, moving);
        return next;
      });
    },
    []
  );

  const hidePhoto = useCallback((src: string) => {
    const photo = photosBySrc.get(src);
    if (!photo) return;
    setHidden((h) => (h.includes(photo.filename) ? h : [...h, photo.filename]));
  }, [photosBySrc]);

  const unhidePhoto = useCallback((filename: string) => {
    const photo = inventory.photos.find((p) => p.filename === filename);
    setHidden((h) => h.filter((f) => f !== filename));
    if (!photo) return;
    setProjects((prev) => {
      if (prev.some((p) => p.assets.includes(photo.src))) return prev;
      const next = cloneProjects(prev);
      const dest =
        next.find((p) => p.sectionKey === photo.sectionKey) ?? next[0];
      if (!dest) return prev;
      dest.assets.push(photo.src);
      return next;
    });
  }, [inventory.photos]);

  const exportJson = useCallback(async () => {
    const payload = layoutPayload();
    const text = `${JSON.stringify(payload, null, 2)}\n`;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "work-layout.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [layoutPayload]);

  const copyJson = useCallback(async () => {
    const text = `${JSON.stringify(layoutPayload(), null, 2)}\n`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [layoutPayload]);

  const onDropPhoto = (destProjectId: string, destIndex: number) => {
    if (!drag) return;
    movePhoto(drag.src, destProjectId, destIndex);
    setDrag(null);
    setDropKey(null);
  };

  const sectionsToShow =
    sectionFilter === "all" ? WORK_SECTION_ORDER : WORK_SECTION_ORDER.filter((s) => s.key === sectionFilter);

  return (
    <div className="min-h-dvh bg-bone text-charcoal">
      <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-bone/90 px-5 py-4 backdrop-blur-sm sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-sans text-[0.55rem] uppercase tracking-[0.22em] text-charcoal/35">
              Development only
            </p>
            <h1 className="mt-1 font-serif text-[1.65rem] font-light tracking-[-0.02em]">
              Portfolio editor
            </h1>
            <p className="mt-1 max-w-xl font-sans text-[0.72rem] leading-relaxed text-charcoal/45">
              Drag photos to reorder or change category. Hide leaves files on
              disk. Save writes the live Work layout on this computer.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 font-sans text-[0.65rem] uppercase tracking-[0.14em] ${
                mode === "edit"
                  ? "bg-charcoal text-bone"
                  : "border border-charcoal/15 text-charcoal/60"
              }`}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 font-sans text-[0.65rem] uppercase tracking-[0.14em] ${
                mode === "preview"
                  ? "bg-charcoal text-bone"
                  : "border border-charcoal/15 text-charcoal/60"
              }`}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>
            <button
              type="button"
              className="rounded-full border border-charcoal/15 px-3 py-1.5 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-charcoal/70 disabled:opacity-40"
              onClick={resetChanges}
              disabled={!unsaved || saveState === "saving"}
            >
              Reset Changes
            </button>
            <button
              type="button"
              className="rounded-full border border-charcoal/15 px-3 py-1.5 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-charcoal/70"
              onClick={copyJson}
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              className="rounded-full border border-charcoal/15 px-3 py-1.5 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-charcoal/70"
              onClick={() => void exportJson()}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="rounded-full bg-charcoal px-5 py-2 font-sans text-[0.72rem] uppercase tracking-[0.16em] text-bone disabled:opacity-40"
              onClick={() => void saveChanges()}
              disabled={!unsaved || saveState === "saving"}
            >
              {saveState === "saving" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
        <p
          className="mt-3 font-sans text-[0.65rem] uppercase tracking-[0.14em]"
          role="status"
          aria-live="polite"
        >
          {saveState === "saving" ? (
            <span className="text-charcoal/50">Saving...</span>
          ) : saveState === "saved" && !unsaved ? (
            <span className="text-charcoal/55">Saved successfully</span>
          ) : saveState === "error" ? (
            <span className="text-charcoal/80">
              Couldn’t save{saveError ? `: ${saveError}` : "."}
            </span>
          ) : unsaved ? (
            <span className="text-charcoal/55">Unsaved changes</span>
          ) : (
            <span className="text-charcoal/30">All changes saved</span>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FilterChip
            active={sectionFilter === "all"}
            onClick={() => setSectionFilter("all")}
          >
            All
          </FilterChip>
          {WORK_SECTION_ORDER.map((s) => (
            <FilterChip
              key={s.key}
              active={sectionFilter === s.key}
              onClick={() => setSectionFilter(s.key)}
            >
              {s.label}
            </FilterChip>
          ))}
          <span className="ml-auto font-sans text-[0.65rem] tabular-nums text-charcoal/35">
            {visibleCount} showing · {hiddenPhotos.length} hidden
          </span>
        </div>
      </header>

      {mode === "preview" ? (
        <PreviewBoard
          projects={projects}
          photosBySrc={photosBySrc}
          hiddenSet={hiddenSet}
        />
      ) : (
        <div className="px-5 py-8 sm:px-8">
          {sectionsToShow.map((section) => {
            const sectionProjects = projects.filter(
              (p) => p.sectionKey === section.key
            );
            return (
              <section key={section.key} className="mb-14">
                <h2 className="mb-5 font-serif text-[1.35rem] font-light text-charcoal/55">
                  {section.label}
                </h2>
                <div
                  className="min-h-[8rem] rounded-sm border border-dashed border-charcoal/10 p-3"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropKey(`section:${section.key}`);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const last = sectionProjects[sectionProjects.length - 1];
                    if (last && drag) onDropPhoto(last.id, last.assets.length);
                  }}
                >
                  {sectionProjects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      photosBySrc={photosBySrc}
                      hiddenSet={hiddenSet}
                      dragSrc={drag?.src ?? null}
                      dropKey={dropKey}
                      setDropKey={setDropKey}
                      onDragStart={(src) =>
                        setDrag({ src, fromProjectId: project.id })
                      }
                      onDragEnd={() => {
                        setDrag(null);
                        setDropKey(null);
                      }}
                      onDropAt={(index) => onDropPhoto(project.id, index)}
                      onHide={hidePhoto}
                      onMoveSection={(src, nextSection) => {
                        setProjects((prev) => {
                          const dest = prev.find(
                            (p) => p.sectionKey === nextSection
                          );
                          if (!dest) return prev;
                          const next = cloneProjects(prev);
                          let moving: string | null = null;
                          for (const p of next) {
                            const i = p.assets.indexOf(src);
                            if (i !== -1) {
                              moving = p.assets.splice(i, 1)[0] ?? null;
                              break;
                            }
                          }
                          const target = next.find((p) => p.id === dest.id);
                          if (!target || !moving) return prev;
                          target.assets.push(moving);
                          return next;
                        });
                      }}
                    />
                  ))}
                  {sectionProjects.length === 0 ? (
                    <p className="px-2 py-8 font-sans text-[0.7rem] text-charcoal/30">
                      Drop photos here to move them into {section.label}.
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}

          <section className="mt-4 border-t border-charcoal/10 pt-10">
            <h2 className="mb-2 font-serif text-[1.35rem] font-light text-charcoal/55">
              Hidden
            </h2>
            <p className="mb-5 font-sans text-[0.7rem] text-charcoal/40">
              Hidden photos stay in the project folders. Unhide to return them to
              Work.
            </p>
            {hiddenPhotos.length === 0 ? (
              <p className="font-sans text-[0.7rem] text-charcoal/30">
                Nothing hidden beyond an empty tray.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-4">
                {hiddenPhotos.map((photo) => (
                  <li key={photo.src} className="w-[9.5rem]">
                    <Thumb photo={photo} muted />
                    <button
                      type="button"
                      className="mt-2 font-sans text-[0.6rem] uppercase tracking-[0.14em] text-charcoal/50 hover:text-charcoal"
                      onClick={() => unhidePhoto(photo.filename)}
                    >
                      Unhide
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 font-sans text-[0.6rem] uppercase tracking-[0.12em] ${
        active
          ? "bg-charcoal/90 text-bone"
          : "text-charcoal/40 hover:text-charcoal/70"
      }`}
    >
      {children}
    </button>
  );
}

function ProjectRow({
  project,
  photosBySrc,
  hiddenSet,
  dragSrc,
  dropKey,
  setDropKey,
  onDragStart,
  onDragEnd,
  onDropAt,
  onHide,
  onMoveSection,
}: {
  project: AdminProject;
  photosBySrc: Map<string, AdminPhoto>;
  hiddenSet: Set<string>;
  dragSrc: string | null;
  dropKey: string | null;
  setDropKey: (k: string | null) => void;
  onDragStart: (src: string) => void;
  onDragEnd: () => void;
  onDropAt: (index: number) => void;
  onHide: (src: string) => void;
  onMoveSection: (src: string, section: WorkSectionKey) => void;
}) {
  const visible = project.assets
    .map((src) => photosBySrc.get(src))
    .filter((p): p is AdminPhoto => p != null && !hiddenSet.has(p.filename));

  return (
    <div className="mb-6 last:mb-0">
      <p className="mb-2 font-sans text-[0.55rem] uppercase tracking-[0.18em] text-charcoal/30">
        {project.title}
      </p>
      <ul className="flex flex-wrap gap-3">
        {visible.map((photo, i) => (
          <li
            key={photo.src}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropKey(`${project.id}:${i}`);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropAt(project.assets.indexOf(photo.src));
            }}
            className={`relative ${
              dropKey === `${project.id}:${i}`
                ? "ring-1 ring-charcoal/40 ring-offset-2 ring-offset-bone"
                : ""
            } ${dragSrc === photo.src ? "opacity-40" : ""}`}
          >
            <PhotoCard
              photo={photo}
              onDragStart={() => onDragStart(photo.src)}
              onDragEnd={onDragEnd}
              onHide={() => onHide(photo.src)}
              currentSection={project.sectionKey}
              onMoveSection={(section) => onMoveSection(photo.src, section)}
            />
          </li>
        ))}
        <li
          className="flex h-[10.5rem] w-10 items-center justify-center"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropKey(`${project.id}:end`);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDropAt(project.assets.length);
          }}
        >
          <span
            className={`block h-full w-px ${
              dropKey === `${project.id}:end` ? "bg-charcoal/50" : "bg-transparent"
            }`}
          />
        </li>
      </ul>
    </div>
  );
}

function PhotoCard({
  photo,
  currentSection,
  onDragStart,
  onDragEnd,
  onHide,
  onMoveSection,
}: {
  photo: AdminPhoto;
  currentSection: WorkSectionKey;
  onDragStart: () => void;
  onDragEnd: () => void;
  onHide: () => void;
  onMoveSection: (section: WorkSectionKey) => void;
}) {
  return (
    <figure className="w-[9.5rem]">
      <div className="relative">
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", photo.src);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          className="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-sm bg-bone/80 text-charcoal/55"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripIcon />
        </button>
        <Thumb photo={photo} />
      </div>
      <figcaption className="mt-1.5 flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-sans text-[0.55rem] text-charcoal/40">
          {photo.filename}
        </span>
        <button
          type="button"
          className="shrink-0 font-sans text-[0.55rem] uppercase tracking-[0.12em] text-charcoal/40 hover:text-charcoal"
          onClick={onHide}
        >
          Hide
        </button>
      </figcaption>
      <label className="sr-only" htmlFor={`move-${photo.src}`}>
        Move to category
      </label>
      <select
        id={`move-${photo.src}`}
        className="mt-1 w-full bg-transparent font-sans text-[0.55rem] uppercase tracking-[0.1em] text-charcoal/45"
        value={currentSection}
        onChange={(e) => {
          const next = e.target.value as WorkSectionKey;
          if (next !== currentSection) onMoveSection(next);
        }}
      >
        {WORK_SECTION_ORDER.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </figure>
  );
}

function Thumb({ photo, muted }: { photo: AdminPhoto; muted?: boolean }) {
  const src = photoThumb(photo);
  const ratio = photo.width / Math.max(1, photo.height);
  return (
    <div
      className={`relative overflow-hidden bg-charcoal/5 ${muted ? "opacity-55" : ""}`}
      style={{ height: "10.5rem", width: `${Math.max(5.5, Math.min(9.5, 10.5 * ratio))}rem` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full object-contain object-center"
      />
      {photo.kind === "video" ? (
        <span className="absolute bottom-1.5 right-1.5 font-sans text-[0.5rem] uppercase tracking-[0.12em] text-bone">
          Video
        </span>
      ) : null}
    </div>
  );
}

function PreviewBoard({
  projects,
  photosBySrc,
  hiddenSet,
}: {
  projects: AdminProject[];
  photosBySrc: Map<string, AdminPhoto>;
  hiddenSet: Set<string>;
}) {
  return (
    <div className="px-5 py-10 sm:px-8">
      <p className="mb-10 max-w-lg font-sans text-[0.72rem] text-charcoal/40">
        Work page order for each category. This is a layout preview, not the live
        site.
      </p>
      {WORK_SECTION_ORDER.map((section) => {
        const items = projects
          .filter((p) => p.sectionKey === section.key)
          .flatMap((p) =>
            p.assets
              .map((src) => photosBySrc.get(src))
              .filter(
                (p): p is AdminPhoto => p != null && !hiddenSet.has(p.filename)
              )
          );
        if (items.length === 0) return null;
        return (
          <section key={section.key} className="mb-12">
            <h2 className="mb-4 font-serif text-[1.4rem] font-light text-charcoal/48">
              {section.label}
            </h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              {items.map((photo) => (
                <div
                  key={photo.src}
                  className="h-[14.5rem] shrink-0"
                  style={{
                    aspectRatio: `${photo.width} / ${photo.height}`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoThumb(photo)}
                    alt=""
                    className="h-full w-full object-contain object-center"
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <circle cx="3" cy="3" r="0.9" fill="currentColor" />
      <circle cx="9" cy="3" r="0.9" fill="currentColor" />
      <circle cx="3" cy="6" r="0.9" fill="currentColor" />
      <circle cx="9" cy="6" r="0.9" fill="currentColor" />
      <circle cx="3" cy="9" r="0.9" fill="currentColor" />
      <circle cx="9" cy="9" r="0.9" fill="currentColor" />
    </svg>
  );
}

