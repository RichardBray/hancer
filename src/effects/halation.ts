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
    // Wider, softer highlight ramp to match WebGPU smoothstep threshold
    steps.push(`[hal_glowsrc]curves=r='0/0 0.5/0 0.85/1 1/1':g='0/0 0.5/0 0.85/1 1/1':b='0/0 0.5/0 0.85/1 1/1'[hal_highlights]`);
    // Downsample → blur → upsample → hue shift (matches WebGPU: blur first, color shift after)
    steps.push(`[hal_highlights]scale=iw/2:ih/2,gblur=sigma=${sigma},scale=iw*2:ih*2,hue=h=${hueDeg}:s=${saturation.toFixed(4)}[hal_blurred]`);
  } else {
    steps.push(`[hal_glowsrc]scale=iw/2:ih/2,gblur=sigma=${sigma},scale=iw*2:ih*2,hue=h=${hueDeg}:s=${saturation.toFixed(4)}[hal_blurred]`);
  }

  steps.push(`[hal_orig][hal_blurred]blend=all_mode=screen:all_opacity=${amount.toFixed(4)}[halation_out]`);

  return { fragment: steps.join(";"), output: "halation_out" };
}
