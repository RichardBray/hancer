import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { userPresetsDir, listPresetNames, rebuildPresetIndex } from "@hance/core";
import type { PresetData } from "@hance/core";
import { parseEffectFlags, EFFECT_HELP_TEXT } from "../effect-flags";

declare const HANCE_VERSION: string | undefined;
const VERSION: string = (typeof HANCE_VERSION !== "undefined" ? HANCE_VERSION : (process.env.HANCE_VERSION ?? "dev"));

const PRESET_HELP = `\
hance preset save <name> [effect flags...] [--force]
hance preset list

  save: writes ~/.hance/presets/<name>.hlook with the given effect flags.
  list: prints preset names from ~/.hance/presets and the builtin dir.

${EFFECT_HELP_TEXT}
`;

export function validatePresetName(name: string): void {
  if (!name) throw new Error("preset name cannot be empty");
  if (/[\/\\]/.test(name)) throw new Error("preset name cannot contain path separators");
  if (name.startsWith(".")) throw new Error("preset name cannot start with a dot");
  if (/\s/.test(name)) throw new Error("preset name cannot contain whitespace");
}

export interface PresetSaveArgs {
  name: string;
  overrides: PresetData;
  force: boolean;
  help: boolean;
}

export function parsePresetSaveArgs(argv: string[]): PresetSaveArgs {
  const force = argv.includes("--force");
  const filtered = argv.filter((a) => a !== "--force");
  const r = parseEffectFlags(filtered);
  if (r.help) return { name: "", overrides: {}, force: false, help: true };
  if (r.positional.length === 0) throw new Error("preset save: <name> required");
  return { name: r.positional[0], overrides: r.overrides, force, help: false };
}

async function runSave(argv: string[]): Promise<void> {
  let parsed: PresetSaveArgs;
  try { parsed = parsePresetSaveArgs(argv); }
  catch (e) { console.error(`Error: ${(e as Error).message}`); process.exit(1); }
  if (parsed.help) { console.log(PRESET_HELP); return; }

  try { validatePresetName(parsed.name); }
  catch (e) { console.error(`Error: ${(e as Error).message}`); process.exit(1); }

  const dir = userPresetsDir();
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${parsed.name}.hlook`);
  if (existsSync(file) && !parsed.force) {
    console.error(`preset "${parsed.name}" already exists. Use --force to overwrite.`);
    process.exit(1);
  }

  writeFileSync(file, JSON.stringify({ hance_version: VERSION, name: parsed.name, params: parsed.overrides }, null, 2));
  try { rebuildPresetIndex(); } catch (err) { console.error("preset index rebuild failed:", (err as Error).message); }
  process.stdout.write(path.resolve(file) + "\n");
}

function runList(): void {
  const sorted = listPresetNames();
  if (sorted.length > 0) process.stdout.write(sorted.join("\n") + "\n");
}

export async function runPreset(argv: string[]): Promise<void> {
  if (argv[0] === "--help" || argv[0] === "-h" || argv.length === 0) {
    console.log(PRESET_HELP); return;
  }
  if (argv[0] === "save") return runSave(argv.slice(1));
  if (argv[0] === "list") { runList(); return; }
  console.error(`Unknown preset subcommand: ${argv[0]}`); process.exit(1);
}
