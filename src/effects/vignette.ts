import type { FilterResult, VignetteOptions } from "../types";
import { passthrough } from "./utils";

const HALF_PI = Math.PI / 2;

export function vignetteFilter(input: string, options: VignetteOptions): FilterResult {
  if (!options.enabled) return passthrough(input, "vignette_out");

  const { amount, size } = options;
  const angle = (amount * HALF_PI).toFixed(4);
  const aspect = (1 - size * 0.5).toFixed(4);

  const fragment = `[${input}]vignette=angle=${angle}:aspect=${aspect}[vignette_out]`;
  return { fragment, output: "vignette_out" };
}
