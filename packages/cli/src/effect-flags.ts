import type { PresetData, OutputCodec, ExportPreset } from "@hance/core";

export const EFFECT_HELP_TEXT = `\
  Color Settings:
  --exposure          <-2 to 2>     Exposure adjustment (default: 0)
  --contrast          <0-3>         Contrast multiplier (default: 1)
  --highlights        <-1 to 1>     Highlight compression (default: 0)
  --fade              <0-1>         Fade / lift blacks (default: 0)
  --white-balance     <1000-15000>  Color temperature in Kelvin (default: 6500)
  --tint              <-100 to 100> Green-magenta tint (default: 0)
  --subtractive-sat   <0-3>         Subtractive saturation (default: 1)
  --richness          <0-3>         Color richness (default: 1)
  --bleach-bypass     <0-1>         Bleach bypass amount (default: 0)
  --no-color-settings               Disable color settings

  Halation:
  --halation-amount         <0-1>   Halation strength (default: 0.25)
  --halation-radius         <1-100> Blur radius (default: 4)
  --halation-saturation     <0-3>   Glow saturation (default: 1)
  --halation-hue            <0-1>   Hue rotation 0-1 (default: 0.5)
  --halation-highlights-only        Restrict to highlights (default: true)
  --no-halation                     Disable halation

  Chromatic Aberration:
  --aberration  <0-1>       Aberration amount (default: 0.3)
  --no-aberration           Disable aberration

  Bloom:
  --bloom-amount   <0-1>    Bloom strength (default: 0.25)
  --bloom-radius   <1-100>  Bloom blur radius (default: 10)
  --no-bloom                Disable bloom

  Grain:
  --grain-amount     <0-1>    Grain intensity (default: 0.125)
  --grain-size       <0-5>    Grain particle size (default: 0)
  --grain-softness   <0-1>    Grain softness (default: 0.1)
  --grain-saturation <0-1>    Grain color saturation (default: 0.3)
  --grain-defocus    <0-5>    Image defocus amount (default: 1)
  --no-grain                  Disable grain

  Vignette:
  --vignette-amount  <0-1>   Vignette strength (default: 0.25)
  --vignette-size    <0-1>   Vignette size (default: 0.25)
  --no-vignette              Disable vignette

  Split Tone:
  --split-tone-mode      <natural|complementary>  (default: natural)
  --split-tone-protect-neutrals                   Protect neutral colors
  --split-tone-amount    <0-1>    Toning amount (default: 0)
  --split-tone-hue       <0-360>  Hue angle in degrees (default: 20)
  --split-tone-pivot     <0-1>    Shadow/highlight pivot (default: 0.3)
  --no-split-tone                 Disable split tone

  Camera Shake:
  --camera-shake-amount  <0-1>   Shake intensity (default: 0.25)
  --camera-shake-rate    <0-2>   Shake speed (default: 0.5)
  --no-camera-shake              Disable camera shake`;

const KNOWN_FLAGS = new Set([
  "--output", "-o", "--preset", "--codec", "--encode-preset", "--crf", "--blend", "--export",
  "--exposure", "--contrast", "--highlights", "--fade",
  "--white-balance", "--tint", "--subtractive-sat", "--richness", "--bleach-bypass",
  "--no-color-settings",
  "--halation-amount", "--halation-radius", "--halation-saturation", "--halation-hue",
  "--halation-highlights-only", "--no-halation",
  "--aberration", "--no-aberration",
  "--bloom-amount", "--bloom-radius", "--no-bloom",
  "--grain-amount", "--grain-size", "--grain-softness", "--grain-saturation", "--grain-defocus",
  "--no-grain",
  "--vignette-amount", "--vignette-size", "--no-vignette",
  "--split-tone-mode", "--split-tone-protect-neutrals", "--split-tone-amount",
  "--split-tone-hue", "--split-tone-pivot", "--no-split-tone",
  "--camera-shake-amount", "--camera-shake-rate", "--no-camera-shake",
  "--help", "-h",
]);

const BOOLEAN_FLAGS = new Set([
  "--no-color-settings", "--no-halation", "--no-aberration", "--no-bloom",
  "--no-grain", "--no-vignette", "--no-split-tone", "--no-camera-shake",
  "--halation-highlights-only", "--split-tone-protect-neutrals",
]);

function parseNum(value: string, flag: string, min: number, max: number): number {
  const n = parseFloat(value);
  if (isNaN(n) || n < min || n > max) {
    throw new Error(`${flag} must be between ${min} and ${max}, got ${value}`);
  }
  return n;
}

export interface ParsedEffectFlags {
  overrides: PresetData;
  positional: string[];
  presetName: string;
  outputArg: string;
  exportPreset: ExportPreset | undefined;
  overrideCodec: OutputCodec | undefined;
  overrideCrf: number | undefined;
  overrideEncodePreset: "fast" | "medium" | "slow" | undefined;
  help: boolean;
}

export function parseEffectFlags(argv: string[]): ParsedEffectFlags {
  const overrides: PresetData = {};
  const positional: string[] = [];
  let presetName = "default";
  let outputArg = "";
  let help = false;
  let exportPreset: ExportPreset | undefined;
  let overrideCodec: OutputCodec | undefined;
  let overrideCrf: number | undefined;
  let overrideEncodePreset: "fast" | "medium" | "slow" | undefined;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") { help = true; i++; continue; }
    if (!arg.startsWith("-")) { positional.push(arg); i++; continue; }
    if (!KNOWN_FLAGS.has(arg)) throw new Error(`Unknown flag: ${arg}. Use --help for usage.`);

    if (BOOLEAN_FLAGS.has(arg)) {
      switch (arg) {
        case "--no-color-settings": overrides["no-color-settings"] = true; break;
        case "--no-halation": overrides["no-halation"] = true; break;
        case "--no-aberration": overrides["no-aberration"] = true; break;
        case "--no-bloom": overrides["no-bloom"] = true; break;
        case "--no-grain": overrides["no-grain"] = true; break;
        case "--no-vignette": overrides["no-vignette"] = true; break;
        case "--no-split-tone": overrides["no-split-tone"] = true; break;
        case "--no-camera-shake": overrides["no-camera-shake"] = true; break;
        case "--halation-highlights-only": overrides["halation-highlights-only"] = true; break;
        case "--split-tone-protect-neutrals": overrides["split-tone-protect-neutrals"] = true; break;
      }
      i++; continue;
    }

    const val = argv[i + 1];
    if (val === undefined) throw new Error(`${arg} requires a value`);

    switch (arg) {
      case "--output": case "-o": outputArg = val; break;
      case "--preset": presetName = val; break;
      case "--codec":
        if (val !== "h264" && val !== "prores" && val !== "h265") throw new Error(`--codec must be h264, prores, or h265, got ${val}`);
        overrideCodec = val; overrides["codec"] = val; break;
      case "--encode-preset":
        if (val !== "fast" && val !== "medium" && val !== "slow") throw new Error(`--encode-preset must be fast, medium, or slow, got ${val}`);
        overrideEncodePreset = val; overrides["encode-preset"] = val; break;
      case "--export":
        if (val !== "low" && val !== "medium" && val !== "high" && val !== "max") throw new Error(`--export must be low, medium, high, or max, got ${val}`);
        exportPreset = val as ExportPreset; break;
      case "--crf": overrideCrf = parseNum(val, "--crf", 0, 51); overrides["crf"] = overrideCrf; break;
      case "--blend": overrides["blend"] = parseNum(val, "--blend", 0, 1); break;
      case "--exposure": overrides["exposure"] = parseNum(val, "--exposure", -2, 2); break;
      case "--contrast": overrides["contrast"] = parseNum(val, "--contrast", 0, 3); break;
      case "--highlights": overrides["highlights"] = parseNum(val, "--highlights", -1, 1); break;
      case "--fade": overrides["fade"] = parseNum(val, "--fade", 0, 1); break;
      case "--white-balance": overrides["white-balance"] = parseNum(val, "--white-balance", 1000, 15000); break;
      case "--tint": overrides["tint"] = parseNum(val, "--tint", -100, 100); break;
      case "--subtractive-sat": overrides["subtractive-sat"] = parseNum(val, "--subtractive-sat", 0, 3); break;
      case "--richness": overrides["richness"] = parseNum(val, "--richness", 0, 3); break;
      case "--bleach-bypass": overrides["bleach-bypass"] = parseNum(val, "--bleach-bypass", 0, 1); break;
      case "--halation-amount": overrides["halation-amount"] = parseNum(val, "--halation-amount", 0, 1); break;
      case "--halation-radius": overrides["halation-radius"] = parseNum(val, "--halation-radius", 1, 100); break;
      case "--halation-saturation": overrides["halation-saturation"] = parseNum(val, "--halation-saturation", 0, 3); break;
      case "--halation-hue": overrides["halation-hue"] = parseNum(val, "--halation-hue", 0, 1); break;
      case "--aberration": overrides["aberration"] = parseNum(val, "--aberration", 0, 1); break;
      case "--bloom-amount": overrides["bloom-amount"] = parseNum(val, "--bloom-amount", 0, 1); break;
      case "--bloom-radius": overrides["bloom-radius"] = parseNum(val, "--bloom-radius", 1, 100); break;
      case "--grain-amount": overrides["grain-amount"] = parseNum(val, "--grain-amount", 0, 1); break;
      case "--grain-size": overrides["grain-size"] = parseNum(val, "--grain-size", 0, 5); break;
      case "--grain-softness": overrides["grain-softness"] = parseNum(val, "--grain-softness", 0, 1); break;
      case "--grain-saturation": overrides["grain-saturation"] = parseNum(val, "--grain-saturation", 0, 1); break;
      case "--grain-defocus": overrides["grain-defocus"] = parseNum(val, "--grain-defocus", 0, 5); break;
      case "--vignette-amount": overrides["vignette-amount"] = parseNum(val, "--vignette-amount", 0, 1); break;
      case "--vignette-size": overrides["vignette-size"] = parseNum(val, "--vignette-size", 0, 1); break;
      case "--split-tone-mode":
        if (val !== "natural" && val !== "complementary") throw new Error(`--split-tone-mode must be natural or complementary, got ${val}`);
        overrides["split-tone-mode"] = val; break;
      case "--split-tone-amount": overrides["split-tone-amount"] = parseNum(val, "--split-tone-amount", 0, 1); break;
      case "--split-tone-hue": overrides["split-tone-hue"] = parseNum(val, "--split-tone-hue", 0, 360); break;
      case "--split-tone-pivot": overrides["split-tone-pivot"] = parseNum(val, "--split-tone-pivot", 0, 1); break;
      case "--camera-shake-amount": overrides["camera-shake-amount"] = parseNum(val, "--camera-shake-amount", 0, 1); break;
      case "--camera-shake-rate": overrides["camera-shake-rate"] = parseNum(val, "--camera-shake-rate", 0, 2); break;
    }
    i += 2;
  }

  return { overrides, positional, presetName, outputArg, exportPreset, overrideCodec, overrideCrf, overrideEncodePreset, help };
}
