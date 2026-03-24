import type { FilterResult, GrainOptions } from "../types";
import { passthrough } from "./utils";

export function grainFilter(input: string, options: GrainOptions): FilterResult {
  if (!options.enabled) return passthrough(input, "grain_out");

  const { amount, size, softness, saturation, imageDefocus } = options;

  const noiseIntensity = Math.round(amount * 100);

  // Merge size and softness into a single gblur pass when both are active
  const combinedSigma = Math.sqrt((size * 2) ** 2 + (softness * 1.5) ** 2);
  const grainBlur = combinedSigma > 0 ? `,gblur=sigma=${combinedSigma.toFixed(2)}` : "";

  const noiseFilter = `noise=alls=${noiseIntensity}:allf=t`;
  const defocusChain = imageDefocus > 0 ? `gblur=sigma=${(imageDefocus * 0.5).toFixed(2)},` : "";
  const grainSat = `,hue=s=${saturation.toFixed(4)}`;

  const fragment = [
    `[${input}]split=2[grain_orig][grain_base];`,
    `[grain_base]${defocusChain}${noiseFilter}${grainBlur}${grainSat}[grain_noisy];`,
    `[grain_orig][grain_noisy]blend=all_mode=overlay:all_opacity=${amount.toFixed(4)}[grain_out]`,
  ].join("");

  return { fragment, output: "grain_out" };
}
