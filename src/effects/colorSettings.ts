import type { FilterResult, ColorSettingsOptions } from "../types";

export function colorSettingsFilter(input: string, options: ColorSettingsOptions): FilterResult {
  if (!options.enabled) {
    return { fragment: `[${input}]null[color_out]`, output: "color_out" };
  }

  const filters: string[] = [];

  // Exposure: map to eq brightness (-1 to 1 range, exposure is typically -2 to +2)
  // Contrast: direct mapping to eq contrast
  // Fade: reduces contrast and lifts blacks (brightness boost)
  const contrast = (options.contrast * (1 - options.fade)).toFixed(4);
  const brightness = (options.exposure * 0.1 + options.fade * 0.05).toFixed(4);
  const saturation = (options.subtractiveSat * options.richness).toFixed(4);

  // Highlights: compress highlights by adjusting gamma
  const gamma = (1 - options.highlights * 0.5).toFixed(4);

  filters.push(`eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}:gamma=${gamma}`);

  // White balance via colortemperature
  if (options.whiteBalance !== 6500) {
    filters.push(`colortemperature=temperature=${options.whiteBalance}`);
  }

  // Tint: green-magenta shift via colorbalance
  if (options.tint !== 0) {
    const tintVal = (options.tint / 100).toFixed(4);
    filters.push(`colorbalance=gm=${tintVal}:gh=${tintVal}:gs=${tintVal}`);
  }

  // Bleach bypass: blend with desaturated high-contrast version
  if (options.bleachBypass > 0) {
    const bp = options.bleachBypass.toFixed(4);
    const mainChain = filters.join(",");
    const fragment = [
      `[${input}]split=2[clr_main][clr_bp];`,
      `[clr_main]${mainChain}[clr_graded];`,
      `[clr_bp]${mainChain},hue=s=0,eq=contrast=1.3[clr_desat];`,
      `[clr_graded][clr_desat]blend=all_mode=normal:all_opacity=${bp}[color_out]`,
    ].join("");
    return { fragment, output: "color_out" };
  }

  const fragment = `[${input}]${filters.join(",")}[color_out]`;
  return { fragment, output: "color_out" };
}
