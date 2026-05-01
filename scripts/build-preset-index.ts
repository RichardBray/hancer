#!/usr/bin/env bun
// Generate presets/index.json from every .hlook in presets/.
// Skill `try` reads this index instead of cat'ing every file.
import { join, resolve } from "node:path";
import { rebuildPresetIndex } from "../packages/core/src/preset-index";

const repoRoot = resolve(import.meta.dir, "..");
const outPath = join(repoRoot, "presets", "index.json");
const written = rebuildPresetIndex(outPath, { includeUser: false, includeBuiltin: true });
console.log(`wrote ${written}`);
