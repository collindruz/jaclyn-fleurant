import { promises as fs } from "fs";
import path from "path";
import {
  applyWorkLayout,
  isWorkLayoutActive,
  normalizeWorkProjectSections,
  parseWorkLayout,
  type WorkLayoutFile,
  type WorkProjectSections,
} from "./work-layout";
import { buildWorkProjectSectionsFromCatalog } from "./placeholders";

const LAYOUT_FILENAME = "work-layout.json";
const LAYOUT_PATH = path.join(process.cwd(), "lib", LAYOUT_FILENAME);
const LAYOUT_TMP_PATH = `${LAYOUT_PATH}.tmp`;

export function workLayoutDiskPath(): string {
  return LAYOUT_PATH;
}

export async function loadWorkLayoutFromDisk(): Promise<WorkLayoutFile | null> {
  try {
    const raw = await fs.readFile(LAYOUT_PATH, "utf8");
    const data = JSON.parse(raw) as unknown;
    const parsed = parseWorkLayout(data);
    if (parsed.ok) return parsed.layout;
    if (isWorkLayoutActive(data as WorkLayoutFile)) {
      return data as WorkLayoutFile;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeWorkLayoutAtomic(
  input: unknown
): Promise<{ ok: true; layout: WorkLayoutFile } | { ok: false; error: string }> {
  const parsed = parseWorkLayout(input);
  if (!parsed.ok) return parsed;

  const text = `${JSON.stringify(parsed.layout, null, 2)}\n`;
  const dir = path.dirname(LAYOUT_PATH);
  if (path.basename(LAYOUT_PATH) !== LAYOUT_FILENAME) {
    return { ok: false, error: "Refusing to write an unexpected path." };
  }

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(LAYOUT_TMP_PATH, text, "utf8");
  await fs.rename(LAYOUT_TMP_PATH, LAYOUT_PATH);
  return { ok: true, layout: parsed.layout };
}

/** Live Work sections from disk so /admin Save updates Work without a JSON hand-edit. */
export async function getLiveWorkProjectSections(): Promise<WorkProjectSections> {
  const catalog = normalizeWorkProjectSections(
    buildWorkProjectSectionsFromCatalog()
  );
  try {
    const layout = await loadWorkLayoutFromDisk();
    return normalizeWorkProjectSections(applyWorkLayout(catalog, layout));
  } catch {
    return catalog;
  }
}
