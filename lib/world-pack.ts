export type WorldPackStill = {
  src?: string;
  width: number;
  height: number;
};

export type WorldPackSlot = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Subtle archival tilt, degrees. Packing uses the same value for AABB spacing. */
export const WORLD_PRINT_ROTATE_MIN = -6;
export const WORLD_PRINT_ROTATE_MAX = 6;

export function worldPrintRotate(src: string, index: number): number {
  let h = 2166136261;
  const s = `${src}#${index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const r0 = h / 0xffff_ffff;
  return WORLD_PRINT_ROTATE_MIN + r0 * (WORLD_PRINT_ROTATE_MAX - WORLD_PRINT_ROTATE_MIN);
}

function aspect(still: WorldPackStill): number {
  const w = still.width > 0 ? still.width : 4;
  const h = still.height > 0 ? still.height : 5;
  return w / h;
}

function rotatedAabb(w: number, h: number, deg: number): { w: number; h: number } {
  const rad = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    w: Math.abs(w * c) + Math.abs(h * s),
    h: Math.abs(w * s) + Math.abs(h * c),
  };
}

function rowVariant(rowIndex: number): number {
  let h = (rowIndex + 1) * 2654435761 >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  const r = h / 0xffff_ffff;
  return 0.88 + r * 0.28;
}

type PackedItem = { ar: number; rotate: number };

type Row = { start: number; count: number };

function itemBox(it: PackedItem, h: number) {
  const w = Math.max(1, h * it.ar);
  const boxH = Math.max(1, h);
  const aabb = rotatedAabb(w, boxH, it.rotate);
  return { w, h: boxH, aabbW: aabb.w, aabbH: aabb.h };
}

function splitRows(items: readonly PackedItem[], innerW: number, rowH: number, gap: number): Row[] {
  const rows: Row[] = [];
  let start = 0;
  let used = 0;
  let count = 0;

  for (let i = 0; i < items.length; i++) {
    const aabbW = itemBox(items[i], rowH).aabbW;
    const nextUsed = used + (count > 0 ? gap : 0) + aabbW;
    if (count > 0 && nextUsed > innerW) {
      rows.push({ start, count });
      start = i;
      count = 1;
      used = aabbW;
    } else {
      count += 1;
      used = nextUsed;
    }
  }
  if (count > 0) rows.push({ start, count });
  return rows;
}

function layoutRows(
  items: readonly PackedItem[],
  rows: readonly Row[],
  innerW: number,
  rowH: number,
  gap: number,
  pad: number
): { slots: WorldPackSlot[]; totalH: number; totalW: number } {
  const slots: WorldPackSlot[] = new Array(items.length);
  let y = pad;
  let maxX = pad;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const last = r === rows.length - 1;
    const nGap = Math.max(0, row.count - 1);
    const targetH = rowH * (last ? 1 : rowVariant(r));
    const boxes: { w: number; h: number; aabbW: number; aabbH: number }[] = [];
    let aabbSum = 0;
    for (let k = 0; k < row.count; k++) {
      const box = itemBox(items[row.start + k], targetH);
      boxes.push(box);
      aabbSum += box.aabbW;
    }

    const naturalW = aabbSum + gap * nGap;
    const fill = innerW > 0 ? naturalW / innerW : 1;
    let scale: number;
    if (!last || fill >= 0.7) {
      scale = aabbSum > 0 ? (innerW - gap * nGap) / aabbSum : 1;
    } else {
      scale = Math.min(1.18, aabbSum > 0 ? (innerW - gap * nGap) / aabbSum : 1);
    }

    const placed: { w: number; h: number; aabbW: number; aabbH: number }[] = [];
    let rowAabbH = 1;
    let usedW = gap * nGap;
    for (let k = 0; k < row.count; k++) {
      const it = items[row.start + k];
      const w = Math.max(1, boxes[k].w * scale);
      const h = Math.max(1, boxes[k].h * scale);
      const aabb = rotatedAabb(w, h, it.rotate);
      placed.push({ w, h, aabbW: aabb.w, aabbH: aabb.h });
      rowAabbH = Math.max(rowAabbH, aabb.h);
      usedW += aabb.w;
    }

    let x = pad;
    if (last && fill < 0.7) {
      x = pad + Math.max(0, (innerW - usedW) / 2);
    }

    for (let k = 0; k < row.count; k++) {
      const p = placed[k];
      const aabbY = y + (rowAabbH - p.aabbH) / 2;
      slots[row.start + k] = {
        x: x + (p.aabbW - p.w) / 2,
        y: aabbY + (p.aabbH - p.h) / 2,
        w: p.w,
        h: p.h,
      };
      x += p.aabbW + gap;
      maxX = Math.max(maxX, x - gap);
    }
    y += rowAabbH + gap;
  }

  return {
    slots,
    totalH: Math.max(pad, y - gap + pad),
    totalW: maxX + pad,
  };
}

function packAt(
  stills: readonly WorldPackStill[],
  boardW: number,
  rowH: number,
  gap: number,
  pad: number
): { slots: WorldPackSlot[]; totalH: number; totalW: number } {
  const innerW = Math.max(1, boardW - pad * 2);
  const items: PackedItem[] = stills.map((still, i) => ({
    ar: aspect(still),
    rotate: worldPrintRotate(still.src ?? `#${i}`, i),
  }));
  const rows = splitRows(items, innerW, rowH, gap);
  return layoutRows(items, rows, innerW, rowH, gap, pad);
}

function boardGap(boardW: number): number {
  if (boardW < 500) return 10;
  if (boardW < 900) return 16;
  if (boardW < 1280) return 22;
  return 28;
}

/**
 * Loose rectangular archival moodboard. Natural aspect kept.
 * Spacing is between rotated AABBs so prints do not overlap at rest.
 */
export function packWorldStills(
  stills: readonly WorldPackStill[],
  boardW: number,
  boardH: number
): { slots: WorldPackSlot[]; thumbMaxH: number; gap: number } {
  if (boardW < 8 || boardH < 8 || stills.length === 0) {
    return { slots: [], thumbMaxH: 0, gap: 0 };
  }

  let gap = boardGap(boardW);
  const pad = gap;
  let lo = 8;
  let hi = Math.max(9, Math.floor(boardH * 0.38));
  let best: ReturnType<typeof packAt> | null = null;
  let bestH = 8;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const packed = packAt(stills, boardW, mid, gap, pad);
    if (packed.totalH <= boardH + 0.5 && packed.totalW <= boardW + 0.5) {
      best = packed;
      bestH = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (!best) {
    const minGap = boardW < 500 ? 6 : 8;
    gap = minGap;
    best = packAt(stills, boardW, 8, gap, Math.min(pad, gap));
    const sx = boardW / Math.max(1, best.totalW);
    const sy = boardH / Math.max(1, best.totalH);
    const s = Math.min(1, sx, sy);
    if (s < 1) {
      best = {
        slots: best.slots.map((p) => ({
          x: p.x * s,
          y: p.y * s,
          w: Math.max(1, p.w * s),
          h: Math.max(1, p.h * s),
        })),
        totalH: best.totalH * s,
        totalW: best.totalW * s,
      };
    }
  }

  const ox = Math.max(0, (boardW - best.totalW) / 2);
  const oy = Math.max(0, (boardH - best.totalH) / 2);
  let thumbMaxH = bestH;
  for (const p of best.slots) thumbMaxH = Math.max(thumbMaxH, p.h);

  return {
    slots: best.slots.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy })),
    thumbMaxH,
    gap,
  };
}
