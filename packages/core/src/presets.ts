import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type {
  ColorSettingsOptions, HalationOptions, AberrationOptions,
  BloomOptions, GrainOptions, VignetteOptions, SplitToneOptions, CameraShakeOptions,
  OutputCodec,
} from "./types";

export interface PresetData {
  [key: string]: string | number | boolean | undefined;
}

interface EffectOptions {
  encodePreset: "fast" | "medium" | "slow";
  codec: OutputCodec;
  crf: number;
  blend: number;
  colorSettings: ColorSettingsOptions;
  halation: HalationOptions;
  aberration: AberrationOptions;
  bloom: BloomOptions;
  grain: GrainOptions;
  vignette: VignetteOptions;
  splitTone: SplitToneOptions;
  cameraShake: CameraShakeOptions;
}

export function builtinPresetsDir(): string {
  return join(import.meta.dir, "..", "..", "..", "presets");
}

export function userPresetsDir(): string {
  return join(homedir(), ".hancer", "presets");
}

export function loadPreset(name: string): PresetData {
  for (const dir of [userPresetsDir(), builtinPresetsDir()]) {
    for (const ext of [".hlook", ".json"]) {
      const filePath = join(dir, `${name}${ext}`);
      if (existsSync(filePath)) {
        return JSON.parse(readFileSync(filePath, "utf-8"));
      }
    }
  }

  throw new Error(`Look "${name}" not found. Looked in:\n  ${userPresetsDir()}\n  ${builtinPresetsDir()}`);
}

interface ApplyPresetResult extends EffectOptions {
  mergedParams: PresetData;
}

function unwrapLookParams(data: PresetData): PresetData {
  if (data.params && typeof data.params === "object") {
    return data.params as PresetData;
  }
  return data;
}

export function applyPreset(
  name: string,
  overrides: PresetData
): ApplyPresetResult {
  const defaults = unwrapLookParams(loadPreset("default"));
  const named = name === "default" ? {} : unwrapLookParams(loadPreset(name));
  const merged = { ...defaults, ...named, ...overrides };

  const colorSettings: ColorSettingsOptions = {
    enabled: merged["no-color-settings"] ? false : true,
    exposure: Number(merged["exposure"] ?? 0),
    contrast: Number(merged["contrast"] ?? 1),
    highlights: Number(merged["highlights"] ?? 0),
    fade: Number(merged["fade"] ?? 0),
    whiteBalance: Number(merged["white-balance"] ?? 6500),
    tint: Number(merged["tint"] ?? 0),
    subtractiveSat: Number(merged["subtractive-sat"] ?? 1),
    richness: Number(merged["richness"] ?? 1),
    bleachBypass: Number(merged["bleach-bypass"] ?? 0),
  };

  const halation: HalationOptions = {
    enabled: merged["no-halation"] ? false : true,
    amount: Number(merged["halation-amount"] ?? 0.25),
    radius: Number(merged["halation-radius"] ?? 4),
    saturation: Number(merged["halation-saturation"] ?? 1),
    hue: Number(merged["halation-hue"] ?? 0.5),
    highlightsOnly: Boolean(merged["halation-highlights-only"] ?? true),
  };

  const aberration: AberrationOptions = {
    enabled: merged["no-aberration"] ? false : true,
    amount: Number(merged["aberration"] ?? 0.3),
  };

  const bloom: BloomOptions = {
    enabled: merged["no-bloom"] ? false : true,
    amount: Number(merged["bloom-amount"] ?? 0.25),
    radius: Number(merged["bloom-radius"] ?? 10),
  };

  const grain: GrainOptions = {
    enabled: merged["no-grain"] ? false : true,
    amount: Number(merged["grain-amount"] ?? 0.125),
    size: Number(merged["grain-size"] ?? 0),
    softness: Number(merged["grain-softness"] ?? 0.1),
    saturation: Number(merged["grain-saturation"] ?? 0.3),
    imageDefocus: Number(merged["grain-defocus"] ?? 1),
  };

  const vignette: VignetteOptions = {
    enabled: merged["no-vignette"] ? false : true,
    amount: Number(merged["vignette-amount"] ?? 0.25),
    size: Number(merged["vignette-size"] ?? 0.25),
  };

  const splitTone: SplitToneOptions = {
    enabled: merged["no-split-tone"] ? false : true,
    mode: (merged["split-tone-mode"] as SplitToneOptions["mode"]) ?? "natural",
    protectNeutrals: Boolean(merged["split-tone-protect-neutrals"] ?? false),
    amount: Number(merged["split-tone-amount"] ?? 0),
    hueAngle: Number(merged["split-tone-hue"] ?? 20),
    pivot: Number(merged["split-tone-pivot"] ?? 0.3),
  };

  const cameraShake: CameraShakeOptions = {
    enabled: merged["no-camera-shake"] ? false : true,
    amount: Number(merged["camera-shake-amount"] ?? 0.25),
    rate: Number(merged["camera-shake-rate"] ?? 0.5),
  };

  const encodePreset = (merged["encode-preset"] as EffectOptions["encodePreset"]) ?? "medium";
  const codec = (merged["codec"] as OutputCodec) ?? "h264";
  const crf = Number(merged["crf"] ?? 18);
  const blend = Number(merged["blend"] ?? 1);

  return { encodePreset, codec, crf, blend, colorSettings, halation, aberration, bloom, grain, vignette, splitTone, cameraShake, mergedParams: merged };
}
