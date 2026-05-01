import { existsSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { builtinPresetsDir, userPresetsDir } from "./presets";

export interface PresetIndexEntry {
  name: string;
  description: string;
  keywords: string[];
  characteristics: string[];
  path: string;
}

function scanDir(dir: string, label: "builtin" | "user"): PresetIndexEntry[] {
  if (!existsSync(dir)) return [];
  const out: PresetIndexEntry[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".hlook")) continue;
    const full = join(dir, file);
    if (!statSync(full).isFile()) continue;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(readFileSync(full, "utf-8"));
    } catch {
      continue;
    }
    out.push({
      name: typeof data.name === "string" ? data.name : file.replace(/\.hlook$/, ""),
      description: typeof data.description === "string" ? data.description : "",
      keywords: Array.isArray(data.keywords) ? (data.keywords as string[]) : [],
      characteristics: Array.isArray(data.characteristics) ? (data.characteristics as string[]) : [],
      path: label === "builtin" ? `presets/${file}` : full,
    });
  }
  return out;
}

export interface BuildOptions {
  includeUser?: boolean;
  includeBuiltin?: boolean;
}

export function buildPresetIndex(opts: BuildOptions = {}): PresetIndexEntry[] {
  const { includeUser = true, includeBuiltin = true } = opts;
  const builtin = includeBuiltin ? scanDir(builtinPresetsDir(), "builtin") : [];
  const user = includeUser ? scanDir(userPresetsDir(), "user") : [];
  const seen = new Set<string>();
  const merged: PresetIndexEntry[] = [];
  for (const e of [...user, ...builtin]) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    merged.push(e);
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function rebuildPresetIndex(outPath?: string, opts: BuildOptions = {}): string {
  const index = buildPresetIndex(opts);
  const target = outPath ?? join(userPresetsDir(), "index.json");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(index, null, 2) + "\n");
  return target;
}
