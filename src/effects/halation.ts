import type { FilterResult, HalationOptions } from "../types";
import { passthrough } from "./utils";

export function halationFilter(input: string, options: HalationOptions): FilterResult {
  if (!options.enabled) return passthrough(input, "halation_out");

  const { amount, radius, saturation, hue, highlightsOnly } = options;

  const sigma = Math.max(1, radius).toFixed(2);
  const hueDeg = (hue * 360).toFixed(2);

  const steps: string[] = [];

  steps.push(`[${input}]split=2[hal_orig][hal_glowsrc]`);

  if (highlightsOnly) {
    steps.push(`[hal_glowsrc]curves=r='0/0 0.65/0 0.75/1 1/1':g='0/0 0.65/0 0.75/1 1/1':b='0/0 0.65/0 0.75/1 1/1'[hal_highlights]`);
    steps.push(`[hal_highlights]hue=h=${hueDeg}:s=${saturation.toFixed(4)},gblur=sigma=${sigma}[hal_blurred]`);
  } else {
    steps.push(`[hal_glowsrc]hue=h=${hueDeg}:s=${saturation.toFixed(4)},gblur=sigma=${sigma}[hal_blurred]`);
  }

  steps.push(`[hal_orig][hal_blurred]blend=all_mode=screen:all_opacity=${amount.toFixed(4)}[halation_out]`);

  return { fragment: steps.join(";"), output: "halation_out" };
}
