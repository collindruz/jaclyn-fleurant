"use client";

import { useCallback, useMemo, useState } from "react";

type Row = {
  src: string;
  kind: "image" | "video";
  context: string;
};

type CellState = "pending" | "ok" | "error";

const filenameFromSrc = (src: string) => {
  const i = src.lastIndexOf("/");
  return i === -1 ? src : src.slice(i + 1);
};

function Preview({
  kind,
  src,
  onResult,
}: {
  kind: "image" | "video";
  src: string;
  onResult: (s: "ok" | "error") => void;
}) {
  const onLoad = useCallback(() => onResult("ok"), [onResult]);
  const onError = useCallback(() => onResult("error"), [onResult]);

  if (kind === "video") {
    return (
      <video
        src={src}
        className="max-h-16 max-w-24 object-contain"
        muted
        playsInline
        preload="metadata"
        onLoadedData={onLoad}
        onError={onError}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      className="max-h-16 max-w-24 object-contain"
      onLoad={onLoad}
      onError={onError}
    />
  );
}

export function DebugImagesClient({ rows }: { rows: Row[] }) {
  const [state, setState] = useState<Record<number, CellState>>({});

  const setResult = useCallback((index: number, s: "ok" | "error") => {
    setState((prev) => ({ ...prev, [index]: s }));
  }, []);

  const keyFor = (row: Row, i: number) => `${i}-${row.src}-${row.context}`;

  const summary = useMemo(() => {
    let ok = 0;
    let err = 0;
    let pending = 0;
    for (let j = 0; j < rows.length; j++) {
      const c = state[j] ?? "pending";
      if (c === "ok") ok++;
      else if (c === "error") err++;
      else pending++;
    }
    return { ok, err, pending, total: rows.length };
  }, [rows, state]);

  return (
    <div className="p-4 font-mono text-sm">
      <h1 className="text-lg font-bold">Debug images (Work data)</h1>
      <p className="text-neutral-600">
        Rows from <code>workSections</code> (same as Work). Load state in browser only.
      </p>
      <p className="mb-2">
        ok: {summary.ok} · error: {summary.err} · pending: {summary.pending} ·
        total: {summary.total}
      </p>
      <table className="w-full max-w-6xl border-collapse border border-neutral-400">
        <thead>
          <tr className="bg-neutral-200 text-left">
            <th className="border border-neutral-400 p-1">#</th>
            <th className="border border-neutral-400 p-1">Context</th>
            <th className="border border-neutral-400 p-1">Filename</th>
            <th className="border border-neutral-400 p-1">src</th>
            <th className="border border-neutral-400 p-1">Loads</th>
            <th className="border border-neutral-400 p-1">Preview</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const s = state[i] ?? "pending";
            const broken = s === "error";
            const status =
              s === "pending" ? "…" : s === "ok" ? "yes" : "NO";
            return (
              <tr
                key={keyFor(row, i)}
                className={broken ? "bg-red-100 text-red-900" : undefined}
              >
                <td className="border border-neutral-400 p-1 align-top text-neutral-500">
                  {i + 1}
                </td>
                <td className="border border-neutral-400 p-1 align-top">
                  {row.context}
                </td>
                <td className="border border-neutral-400 p-1 align-top break-all">
                  {filenameFromSrc(row.src)}
                </td>
                <td className="border border-neutral-400 p-1 align-top break-all">
                  {row.src}
                </td>
                <td className="border border-neutral-400 p-1 align-top">
                  {status}
                </td>
                <td className="border border-neutral-400 p-1 align-top">
                  <Preview
                    kind={row.kind}
                    src={row.src}
                    onResult={(r) => setResult(i, r)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
