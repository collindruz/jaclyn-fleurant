/**
 * Verify local Work catalog srcs exist under public/.
 * Skips http(s) emailed video URLs.
 * Run: npm run check:images
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "lib", "work-catalog.ts");

function publicPathFromUrl(publicUrl) {
  const decoded = decodeURIComponent(publicUrl.split("?")[0] ?? publicUrl);
  return path.join(ROOT, "public", ...decoded.split("/").filter(Boolean));
}

function main() {
  if (!fs.existsSync(CATALOG)) {
    console.error(`[check:images] Missing ${CATALOG} — run npm run work:catalog`);
    process.exit(1);
  }
  const text = fs.readFileSync(CATALOG, "utf8");
  const srcs = [];
  const re = /(?:src|poster):\s*"(\/images\/work\/[^"]+)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    srcs.push(m[1]);
  }
  const missing = [];
  for (const url of srcs) {
    const disk = publicPathFromUrl(url);
    if (!fs.existsSync(disk)) missing.push({ url, disk });
  }
  if (missing.length) {
    console.error(`[check:images] ${missing.length} missing file(s):`);
    for (const { url, disk } of missing) {
      console.error(`  ${url}`);
      console.error(`    ${disk}`);
    }
    process.exit(1);
  }
  console.log(`[check:images] OK — ${srcs.length} local catalog path(s) exist`);
}

main();
