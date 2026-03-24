import type { FilterResult, HalationOptions } from "../types";

export function halationFilter(input: string, options: HalationOptions): FilterResult {
  if (!options.enabled) {
    return { fragment: `[${input}]null[halation_out]`, output: "halation_out" };
  }

  const { amount, radius, saturation, hue, highlightsOnly } = options;

  // Radius maps to gblur sigma
  const sigma = Math.max(1, radius).toFixed(2);

  // Hue maps to hue rotation in degrees (0-1 → 0-360)
  const hueDeg = (hue * 360).toFixed(2);

  const steps: string[] = [];

  steps.push(`[${input}]split=2[hal_orig][hal_glowsrc]`);

  if (highlightsOnly) {
    // Extract highlights via curves threshold
    steps.push(`[hal_glowsrc]curves=r='0/0 0.65/0 0.75/1 1/1':g='0/0 0.65/0 0.75/1 1/1':b='0/0 0.65/0 0.75/1 1/1'[hal_highlights]`);
    steps.push(`[hal_highlights]hue=h=${hueDeg}:s=${saturation.toFixed(4)},gblur=sigma=${sigma}[hal_blurred]`);
  } else {
    steps.push(`[hal_glowsrc]hue=h=${hueDeg}:s=${saturation.toFixed(4)},gblur=sigma=${sigma}[hal_blurred]`);
  }

  steps.push(`[hal_orig][hal_blurred]blend=all_mode=screen:all_opacity=${amount.toFixed(4)}[halation_out]`);

  return { fragment: steps.join(";"), output: "halation_out" };
}
