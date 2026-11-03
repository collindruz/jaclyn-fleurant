export type WorldPackStill = {
  width: number;
  height: number;
};

export type WorldPackSlot = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type RowItem = { index: number; ar: number };

function aspect(still: WorldPackStill): number {
  const w = still.width > 0 ? still.width : 4;
  const h = still.height > 0 ? still.height : 5;
  return w / h;
}

function gutterForBoard(boardW: number): number {
  if (boardW < 640) return 12;
  if (boardW < 1024) return 16;
  if (boardW < 1440) return 20;
  return 24;
}

function splitRows(
  ars: readonly number[],
  innerW: number,
  targetH: number,
  gap: number
): RowItem[][] {
  const rows: RowItem[][] = [];
  let row: RowItem[] = [];
  let arSum = 0;

  for (let i = 0; i < ars.length; i++) {
    const ar = ars[i];
    const n = row.length;
    const nextW = targetH * (arSum + ar) + n * gap;
    if (n > 0 && nextW > innerW) {
      rows.push(row);
      row = [];
      arSum = 0;
    }
    row.push({ index: i, ar });
    arSum += row[row.length - 1].ar;
  }
  if (row.length) rows.push(row);
  return rows;
}

/** Pull items onto a short last row so it can span left-to-right without a hole. */
function fillLastRow(
  rows: RowItem[][],
  innerW: number,
  targetH: number,
  gap: number
): void {
  if (rows.length < 2) return;
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  while (prev.length > 2) {
    const take = prev[prev.length - 1];
    const trialW = targetH * (last.reduce((s, it) => s + it.ar, 0) + take.ar) + last.length * gap;
    if (trialW > innerW) break;
    prev.pop();
    last.unshift(take);
  }
}

function layoutAt(
  stills: readonly WorldPackStill[],
  boardW: number,
  targetH: number,
  gap: number,
  pad: number
): { slots: WorldPackSlot[]; totalH: number; totalW: number } {
  const innerW = Math.max(1, boardW - pad * 2);
  const ars = stills.map(aspect);
  const rows = splitRows(ars, innerW, targetH, gap);
  fillLastRow(rows, innerW, targetH, gap);

  const slots: WorldPackSlot[] = new Array(stills.length);
  let y = pad;
  const innerRight = pad + innerW;
  const lastRowIndex = rows.length - 1;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const n = row.length;
    const arSum = row.reduce((s, it) => s + it.ar, 0);
    const isLast = ri === lastRowIndex;
    const minGaps = Math.max(0, n - 1);
    const justifiedH = (innerW - minGaps * gap) / Math.max(arSum, 0.0001);

    let h: number;
    let rowGaps: number[];
    let spanFull = true;

    if (n <= 0) continue;

    if (!isLast || rows.length === 1) {
      h = Math.max(1, justifiedH);
      rowGaps = Array(minGaps).fill(gap);
    } else if (justifiedH <= targetH * 1.14) {
      h = Math.max(1, justifiedH);
      rowGaps = Array(minGaps).fill(gap);
    } else if (n >= 2) {
      h = targetH;
      const leftover = innerW - h * arSum;
      let g = leftover / (n - 1);
      const maxGap = gap * 2.8;
      if (g > maxGap) {
        h = Math.min(justifiedH, targetH * 1.22);
        g = (innerW - h * arSum) / (n - 1);
      }
      if (g < gap) {
        h = justifiedH;
        rowGaps = Array(minGaps).fill(gap);
      } else {
        rowGaps = Array(minGaps).fill(g);
      }
    } else {
      h = Math.min(targetH, innerW / arSum);
      rowGaps = [];
      spanFull = h * arSum >= innerW - 0.75;
    }

    if (n === 1 && h * row[0].ar > innerW) {
      h = innerW / row[0].ar;
      spanFull = true;
    }

    let x = pad;
    for (let j = 0; j < n; j++) {
      const it = row[j];
      let w = h * it.ar;
      if (j === n - 1 && spanFull) {
        w = Math.max(1, innerRight - x);
      }
      slots[it.index] = { x, y, w, h };
      if (j < n - 1) x += w + rowGaps[j];
    }
    y += h + gap;
  }

  return { slots, totalH: y - gap + pad, totalW: pad + innerW + pad };
}

/**
 * Fit every still into `boardW` × `boardH` as a justified rectangle.
 * Natural aspect is preserved. No crop, rotate, or overlap.
 */
export function packWorldStills(
  stills: readonly WorldPackStill[],
  boardW: number,
  boardH: number
): { slots: WorldPackSlot[]; thumbMaxH: number; gap: number } {
  if (boardW < 8 || boardH < 8 || stills.length === 0) {
    return { slots: [], thumbMaxH: 0, gap: 0 };
  }

  const gap = gutterForBoard(boardW);
  const pad = gap;
  const innerH = Math.max(1, boardH - pad * 2);

  if (stills.length === 1) {
    const ar = aspect(stills[0]);
    let h = Math.min(innerH, (boardW - pad * 2) / ar);
    let w = h * ar;
    const x = pad + Math.max(0, (boardW - pad * 2 - w) / 2);
    const y = pad + Math.max(0, (innerH - h) / 2);
    return { slots: [{ x, y, w, h }], thumbMaxH: h, gap };
  }

  let lo = 8;
  let hi = Math.max(9, Math.floor(innerH));
  let best: ReturnType<typeof layoutAt> | null = null;
  let bestH = 8;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const packed = layoutAt(stills, boardW, mid, gap, pad);
    if (packed.totalH <= boardH) {
      best = packed;
      bestH = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (!best) {
    let g = gap;
    while (g >= 8) {
      const packed = layoutAt(stills, boardW, 8, g, Math.min(pad, g));
      if (packed.totalH <= boardH) {
        best = packed;
        break;
      }
      g -= 2;
    }
    if (!best) {
      const packed = layoutAt(stills, boardW, 8, 8, 8);
      const s = Math.min(1, boardH / Math.max(packed.totalH, 1));
      best = {
        slots: packed.slots.map((p) => ({
          x: p.x * s,
          y: p.y * s,
          w: Math.max(1, p.w * s),
          h: Math.max(1, p.h * s),
        })),
        totalH: packed.totalH * s,
        totalW: packed.totalW * s,
      };
    }
  }

  const oy = Math.max(0, (boardH - best.totalH) / 2);
  const ox = Math.max(0, (boardW - best.totalW) / 2);
  return {
    slots: best.slots.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy })),
    thumbMaxH: bestH,
    gap,
  };
}
