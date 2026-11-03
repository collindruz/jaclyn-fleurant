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

function aspect(still: WorldPackStill): number {
  const w = still.width > 0 ? still.width : 4;
  const h = still.height > 0 ? still.height : 5;
  return w / h;
}

function packAt(
  stills: readonly WorldPackStill[],
  boardW: number,
  maxH: number,
  gap: number,
  pad: number
): { slots: WorldPackSlot[]; totalH: number; totalW: number } {
  const innerW = Math.max(1, boardW - pad * 2);
  const slots: WorldPackSlot[] = [];
  let x = pad;
  let y = pad;
  let rowH = 0;
  let maxX = pad;

  for (const still of stills) {
    const ar = aspect(still);
    let h = maxH;
    let w = h * ar;
    if (w > innerW) {
      w = innerW;
      h = w / ar;
    }
    if (x > pad && x + w > pad + innerW) {
      x = pad;
      y += rowH + gap;
      rowH = 0;
    }
    slots.push({ x, y, w, h });
    x += w + gap;
    rowH = Math.max(rowH, h);
    maxX = Math.max(maxX, x - gap);
  }

  return { slots, totalH: y + rowH + pad, totalW: maxX + pad };
}

/**
 * Fit every still into `boardW` × `boardH` as a wrapping contact sheet.
 * Natural aspect is preserved. Thumb size is the largest that still fits.
 */
export function packWorldStills(
  stills: readonly WorldPackStill[],
  boardW: number,
  boardH: number
): { slots: WorldPackSlot[]; thumbMaxH: number; gap: number } {
  if (boardW < 8 || boardH < 8 || stills.length === 0) {
    return { slots: [], thumbMaxH: 0, gap: 0 };
  }

  const pad = boardW < 500 ? 6 : boardW < 900 ? 8 : 10;
  let gap = boardW < 500 ? 2 : boardW < 900 ? 3 : 4;
  let lo = 6;
  let hi = Math.max(7, Math.floor(boardH / 3));
  let best: ReturnType<typeof packAt> | null = null;
  let bestH = 6;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const packed = packAt(stills, boardW, mid, gap, pad);
    if (packed.totalH <= boardH) {
      best = packed;
      bestH = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (!best) {
    gap = 1;
    best = packAt(stills, boardW, 6, gap, pad);
    if (best.totalH > boardH) {
      const s = boardH / best.totalH;
      best = {
        slots: best.slots.map((p) => ({
          x: p.x * s,
          y: p.y * s,
          w: Math.max(1, p.w * s),
          h: Math.max(1, p.h * s),
        })),
        totalH: boardH,
        totalW: best.totalW * s,
      };
    }
  }

  const ox = Math.max(0, (boardW - best.totalW) / 2);
  const oy = Math.max(0, (boardH - best.totalH) / 2);
  return {
    slots: best.slots.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy })),
    thumbMaxH: bestH,
    gap,
  };
}
