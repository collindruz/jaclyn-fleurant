/**
 * Decode World contact-sheet thumbs at slot pixel size.
 * Catalog stills are thousands of pixels; painting 203 originals in one
 * viewport decodes hundreds of megapixels and can crash the tab.
 */

type ThumbJob = {
  src: string;
  w: number;
  h: number;
  resolve: (url: string) => void;
  reject: (err: unknown) => void;
};

const cache = new Map<string, string>();
const queue: ThumbJob[] = [];
let active = 0;
const MAX_ACTIVE = 4;

function cacheKey(src: string, w: number, h: number) {
  return `${src}@${w}x${h}`;
}

function pump() {
  while (active < MAX_ACTIVE && queue.length > 0) {
    const job = queue.shift();
    if (!job) return;
    active += 1;
    void runJob(job).finally(() => {
      active -= 1;
      pump();
    });
  }
}

async function runJob(job: ThumbJob) {
  const key = cacheKey(job.src, job.w, job.h);
  const hit = cache.get(key);
  if (hit) {
    job.resolve(hit);
    return;
  }
  try {
    const res = await fetch(job.src);
    if (!res.ok) throw new Error(`thumb fetch ${res.status}`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: job.w,
      resizeHeight: job.h,
      resizeQuality: "high",
    });
    const canvas = document.createElement("canvas");
    canvas.width = job.w;
    canvas.height = job.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("thumb canvas");
    }
    ctx.drawImage(bitmap, 0, 0, job.w, job.h);
    bitmap.close();
    const out = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!out) throw new Error("thumb blob");
    const url = URL.createObjectURL(out);
    cache.set(key, url);
    job.resolve(url);
  } catch (err) {
    job.reject(err);
  }
}

export function requestWorldThumb(
  src: string,
  w: number,
  h: number
): Promise<string> {
  const tw = Math.max(1, Math.round(w));
  const th = Math.max(1, Math.round(h));
  const key = cacheKey(src, tw, th);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    queue.push({ src, w: tw, h: th, resolve, reject });
    pump();
  });
}

export function releaseWorldThumbs() {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
  queue.length = 0;
}
