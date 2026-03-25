import type { FilterResult, SplitToneOptions } from "../types";
import { passthrough } from "./utils";
import { getSplitToneTintValues } from "./splitToneMath";

export function splitToneFilter(input: string, options: SplitToneOptions): FilterResult {
  if (!options.enabled) return passthrough(input, "splittone_out");

  const { protectNeutrals, amount } = options;
  const { shadowR, shadowB, highlightR, highlightB, midR } = getSplitToneTintValues(options);

  const colorbalance = `colorbalance=rs=${shadowR.toFixed(4)}:bs=${shadowB.toFixed(4)}:rh=${highlightR.toFixed(4)}:bh=${highlightB.toFixed(4)}:rm=${midR.toFixed(4)}`;

  if (protectNeutrals) {
    const fragment = [
      `[${input}]split=2[st_orig][st_src];`,
      `[st_src]${colorbalance}[st_toned];`,
      `[st_orig][st_toned]blend=all_mode=normal:all_opacity=${amount.toFixed(4)}[splittone_out]`,
    ].join("");
    return { fragment, output: "splittone_out" };
  }

  const fragment = `[${input}]${colorbalance}[splittone_out]`;
  return { fragment, output: "splittone_out" };
}
