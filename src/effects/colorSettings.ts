import type { FilterResult, ColorSettingsOptions } from "../types";
import { passthrough } from "./utils";

export function colorSettingsFilter(input: string, options: ColorSettingsOptions): FilterResult {
  if (!options.enabled) return passthrough(input, "color_out");

  const filters: string[] = [];

  const contrast = (options.contrast * (1 - options.fade)).toFixed(4);
  const brightness = (options.exposure * 0.1 + options.fade * 0.05).toFixed(4);
  const saturation = (options.subtractiveSat * options.richness).toFixed(4);
  const gamma = (1 - options.highlights * 0.5).toFixed(4);

  filters.push(`eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}:gamma=${gamma}`);

  if (options.whiteBalance !== 6500) {
    filters.push(`colortemperature=temperature=${options.whiteBalance}`);
  }

  if (options.tint !== 0) {
    const tintVal = (options.tint / 100).toFixed(4);
    filters.push(`colorbalance=gm=${tintVal}:gh=${tintVal}:gs=${tintVal}`);
  }

  // Bleach bypass: process once, then split for desaturated blend
  if (options.bleachBypass > 0) {
    const bp = options.bleachBypass.toFixed(4);
    const mainChain = filters.join(",");
    const fragment = [
      `[${input}]${mainChain},split=2[clr_graded][clr_bp];`,
      `[clr_bp]hue=s=0,eq=contrast=1.3[clr_desat];`,
      `[clr_graded][clr_desat]blend=all_mode=normal:all_opacity=${bp}[color_out]`,
    ].join("");
    return { fragment, output: "color_out" };
  }

  const fragment = `[${input}]${filters.join(",")}[color_out]`;
  return { fragment, output: "color_out" };
}
