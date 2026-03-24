import type { FilterResult } from "../types";

export function passthrough(input: string, outputLabel: string): FilterResult {
  return { fragment: `[${input}]null[${outputLabel}]`, output: outputLabel };
}
