import type { FilterResult, HalationOptions } from "../types";

export function halationFilter(input: string, options: HalationOptions): FilterResult {
  const { intensity, threshold, warmth } = options;
  let { radius } = options;

  // Enforce odd radius
  if (radius % 2 === 0) radius += 1;

  // Threshold as 0-1 range for curves
  const thresh = (threshold / 255).toFixed(4);
  const threshLow = Math.max(0, threshold / 255 - 0.05).toFixed(4);

  // Warmth controls red boost and blue reduction in tint
  const redBoost = (warmth * 0.3 + 0.7).toFixed(4);
  const blueCut = (1 - warmth * 0.5).toFixed(4);

  const fragment = [
    `[${input}]split=2[hal_orig][hal_glowsrc];`,
    `[hal_glowsrc]curves=r='0/0 ${threshLow}/0 ${thresh}/1 1/1':g='0/0 ${threshLow}/0 ${thresh}/1 1/1':b='0/0 ${threshLow}/0 ${thresh}/1 1/1'[hal_highlights];`,
    `[hal_highlights]curves=r='0/0 1/${redBoost}':b='0/0 1/${blueCut}'[hal_tinted];`,
    `[hal_tinted]gblur=sigma=${radius}[hal_blurred];`,
    `[hal_orig][hal_blurred]blend=all_mode=screen:all_opacity=${intensity.toFixed(4)}[halation_out]`,
  ].join("");

  return { fragment, output: "halation_out" };
}
