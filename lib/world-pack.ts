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
  z: number;
  overlaps: boolean;
};

/** Subtle archival tilt, degrees. Packing uses the same value for AABB spacing. */
export const WORLD_PRINT_ROTATE_MIN = -6;
export const WORLD_PRINT_ROTATE_MAX = 6;

/** Resting print size vs the old single-viewport fit. */
export const WORLD_PRINT_SIZE_SCALE = 1.4;

export function worldPrintRotate(src: string, index: number): number {
  const r0 = hash01(`${src}#${index}`);
  return WORLD_PRINT_ROTATE_MIN + r0 * (WORLD_PRINT_ROTATE_MAX - WORLD_PRINT_ROTATE_MIN);
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 0xffff_ffff;
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
  let h = ((rowIndex + 1) * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  const r = h / 0xffff_ffff;
  return 0.86 + r * 0.32;
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
    if (!last || fill >= 0.72) {
      scale = aabbSum > 0 ? (innerW - gap * nGap) / aabbSum : 1;
    } else {
      scale = Math.min(1.12, aabbSum > 0 ? (innerW - gap * nGap) / aabbSum : 1);
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
    if (last && fill < 0.72) {
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
        z: 20 + row.start + k,
        overlaps: false,
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

/** Neighbor spacing between rotated AABBs, 16–28px. */
function boardGap(boardW: number): number {
  if (boardW < 500) return 16;
  if (boardW < 900) return 20;
  if (boardW < 1280) return 24;
  return 28;
}

/** Typical World board height used only to measure the old single-viewport row size. */
function referenceViewportH(boardW: number): number {
  if (boardW < 500) return 640;
  if (boardW < 900) return 740;
  return 860;
}

function fittedRowH(
  stills: readonly WorldPackStill[],
  boardW: number,
  gap: number,
  pad: number
): number {
  const boardH = referenceViewportH(boardW);
  let lo = 8;
  let hi = Math.max(9, Math.floor(boardH * 0.38));
  let bestH = 8;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const packed = packAt(stills, boardW, mid, gap, pad);
    if (packed.totalH <= boardH + 0.5 && packed.totalW <= boardW + 0.5) {
      bestH = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return bestH;
}

function maxRowH(boardW: number): number {
  return Math.max(96, Math.floor(boardW * 0.42));
}

/** Comfortable print height so the board wraps instead of shrinking to one viewport. */
function comfortRowH(boardW: number): number {
  if (boardW < 500) return 120;
  if (boardW < 900) return 148;
  return 176;
}

/**
 * Loose rectangular archival moodboard. Natural aspect kept.
 * Rest slots use rotated-AABB gaps of 16–28px with no initial overlap.
 * Height is content-driven (not forced into one viewport).
 */
export function packWorldStills(
  stills: readonly WorldPackStill[],
  boardW: number,
  _boardH?: number
): { slots: WorldPackSlot[]; thumbMaxH: number; gap: number; totalH: number; totalW: number } {
  if (boardW < 8 || stills.length === 0) {
    return { slots: [], thumbMaxH: 0, gap: 0, totalH: 0, totalW: 0 };
  }

  const gap = boardGap(boardW);
  const pad = gap;
  const baseline = fittedRowH(stills, boardW, gap, pad);
  const rowH = Math.min(
    maxRowH(boardW),
    Math.max(Math.round(baseline * WORLD_PRINT_SIZE_SCALE), comfortRowH(boardW))
  );

  const packed = packAt(stills, boardW, rowH, gap, pad);

  let thumbMaxH = rowH;
  let maxY = 0;
  const slots = packed.slots.map((p) => {
    thumbMaxH = Math.max(thumbMaxH, p.h);
    maxY = Math.max(maxY, p.y + p.h);
    return { ...p, overlaps: false };
  });

  return {
    slots,
    thumbMaxH,
    gap,
    totalH: Math.max(packed.totalH, maxY + pad),
    totalW: Math.min(boardW, packed.totalW),
  };
}
