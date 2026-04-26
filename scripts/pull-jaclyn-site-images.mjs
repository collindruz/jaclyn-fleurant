/**
 * Fetches https://jaclynfleurant.com/ once, collects image URLs (incl. Squarespace/CDN),
 * downloads to public/images/work/site-pull as site-001.ext, site-002.ext, …
 * Does not request Instagram. Run: npm run pull:site-images
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "public", "images", "work", "site-pull");

const PAGE_URL = "https://jaclynfleurant.com/";
const DELAY_MS = 400;

const INSTAGRAM = /instagram\.com|cdninstagram|igcdn|graph\.instagram/i;

const CT_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
};

function rejectUrl(href) {
  if (!href || href.startsWith("data:") || href.startsWith("javascript:")) return true;
  return INSTAGRAM.test(href);
}

/**
 * @param {string} html
 * @param {string} pageUrl
 * @param {Set<string>} fromImgTag
 */
function collectFromHtml(html, pageUrl, fromImgTag) {
  const found = new Set();
  const base = new URL(pageUrl);

  const add = (raw, isImg) => {
    if (!raw) return;
    const s = String(raw).trim();
    if (!s || s.startsWith("data:")) return;
    try {
      const u = new URL(s, base);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      if (rejectUrl(u.href)) return;
      found.add(u.href);
      if (isImg) fromImgTag.add(u.href);
    } catch {
      /* bad URL */
    }
  };

  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    for (const re of [/\bsrc=["']([^"']+)["']/i, /\bdata-image=["']([^"']+)["']/i, /\bdata-src=["']([^"']+)["']/i]) {
      const x = tag.match(re);
      if (x) add(x[1], true);
    }
  }
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"']+)["']/gi)) {
    for (const p of m[1].split(",")) add(p.trim().split(/\s+/)[0] ?? "", false);
  }
  for (const m of html.matchAll(/<img[^>]+srcset=["']([^"']+)["']/gi)) {
    for (const p of m[1].split(",")) add(p.trim().split(/\s+/)[0] ?? "", false);
  }
  for (const m of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const p of m[1].split(",")) add(p.trim().split(/\s+/)[0] ?? "", false);
  }
  for (const m of html.matchAll(
    /content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi
  )) {
    add(m[1], false);
  }
  for (const m of html.matchAll(
    /(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/gi
  )) {
    add(m[1], false);
  }
  for (const m of html.matchAll(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi)) {
    add(m[1], false);
  }
  for (const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']image_src["']/gi)) {
    add(m[1], false);
  }
  return found;
}

function likelyAssetUrl(href) {
  if (/\.(jpe?g|png|gif|webp|avif|svg)(?:$|[?#])/i.test(href)) return true;
  if (/squarespace|static1\.|sqs-cdn|sqsp|images\.|format=\d/i.test(href)) return true;
  return false;
}

function extFromPath(url) {
  try {
    const p = new URL(url).pathname;
    const e = extname(p).toLowerCase();
    if (e === ".jpeg") return ".jpg";
    if (e && e.length <= 6) return e;
  } catch {
    return "";
  }
  return "";
}

function extFromType(contentType) {
  if (!contentType) return "";
  const main = contentType.split(";")[0].trim().toLowerCase();
  return CT_EXT[main] || "";
}

async function fetchHomepageHtml() {
  const res = await fetch(PAGE_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; JaclynSiteImagePull/1.0; +local build script)",
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`GET ${PAGE_URL} failed: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  let html;
  try {
    html = await fetchHomepageHtml();
  } catch (e) {
    console.error("[fatal] Could not fetch homepage:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const fromImg = new Set();
  const allUrls = collectFromHtml(html, PAGE_URL, fromImg);

  const candidates = [...allUrls].filter((u) => {
    if (rejectUrl(u)) return false;
    if (fromImg.has(u)) return true;
    return likelyAssetUrl(u);
  });

  const unique = [...new Set(candidates)];

  if (unique.length === 0) {
    console.log("No image URLs found on the homepage. Nothing to download.");
    return;
  }

  try {
    await mkdir(OUT_DIR, { recursive: true });
  } catch (e) {
    console.error("[fatal] Could not create output directory:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  let saved = 0;
  let errors = 0;
  let index = 0;

  for (const imageUrl of unique) {
    let res;
    try {
      res = await fetch(imageUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; JaclynSiteImagePull/1.0; +local build script)",
          accept: "image/*,application/octet-stream;q=0.5",
        },
      });
    } catch (e) {
      console.warn(`[warn] fetch failed: ${imageUrl} —`, e instanceof Error ? e.message : e);
      errors += 1;
      await delay(DELAY_MS);
      continue;
    }
    await delay(DELAY_MS);

    if (!res.ok) {
      console.warn(`[warn] ${imageUrl} — HTTP ${res.status}`);
      errors += 1;
      continue;
    }

    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (
      type &&
      (type.includes("text/html") ||
        type.startsWith("application/json") ||
        type.startsWith("text/javascript") ||
        type.startsWith("text/css"))
    ) {
      console.warn(`[warn] skip non-image: ${imageUrl} (${type})`);
      errors += 1;
      continue;
    }

    let ext = extFromPath(imageUrl) || extFromType(type) || ".jpg";

    let buf;
    try {
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.warn(`[warn] read body: ${imageUrl} —`, e instanceof Error ? e.message : e);
      errors += 1;
      continue;
    }

    if (buf.length < 40) {
      console.warn(`[warn] too small, skip: ${imageUrl}`);
      errors += 1;
      continue;
    }

    index += 1;
    const name = `site-${String(index).padStart(3, "0")}${ext}`;
    const filePath = join(OUT_DIR, name);

    try {
      await writeFile(filePath, buf);
      saved += 1;
      console.log(
        `OK ${name} (${(buf.length / 1024).toFixed(1)} KB) <- ${imageUrl.slice(0, 80)}${imageUrl.length > 80 ? "…" : ""}`
      );
    } catch (e) {
      console.warn(`[warn] write ${filePath}:`, e instanceof Error ? e.message : e);
      errors += 1;
      index -= 1;
    }
  }

  console.log(
    `\nDownloaded ${saved} image(s) to public/images/work/site-pull/ (unique URLs: ${unique.length}, write/fetch issues: ${errors}).`
  );
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
