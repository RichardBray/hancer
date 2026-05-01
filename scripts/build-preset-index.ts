#!/usr/bin/env bun
// Generate presets/index.json from every .hlook in presets/.
// Skill `try` reads this index instead of cat'ing every file.
import { readdirSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const presetsDir = join(repoRoot, "presets");
const outPath = join(presetsDir, "index.json");

interface IndexEntry {
  name: string;
  description: string;
  keywords: string[];
  characteristics: string[];
  path: string;
}

const out: IndexEntry[] = [];
for (const file of readdirSync(presetsDir).sort()) {
  if (!file.endsWith(".hlook")) continue;
  const full = join(presetsDir, file);
  if (!statSync(full).isFile()) continue;
  const text = await Bun.file(full).text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`skip (invalid JSON): ${file}`);
    continue;
  }
  out.push({
    name: typeof data.name === "string" ? data.name : file.replace(/\.hlook$/, ""),
    description: typeof data.description === "string" ? data.description : "",
    keywords: Array.isArray(data.keywords) ? (data.keywords as string[]) : [],
    characteristics: Array.isArray(data.characteristics) ? (data.characteristics as string[]) : [],
    path: `presets/${file}`,
  });
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${outPath} (${out.length} presets)`);
