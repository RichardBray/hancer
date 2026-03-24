import type { FilterResult, SplitToneOptions } from "../types";
import { passthrough } from "./utils";

export function splitToneFilter(input: string, options: SplitToneOptions): FilterResult {
  if (!options.enabled) return passthrough(input, "splittone_out");

  const { mode, protectNeutrals, amount, hueAngle, pivot } = options;

  const hueRad = (hueAngle * Math.PI) / 180;
  const cosHue = Math.cos(hueRad);
  const sinHue = Math.sin(hueRad);
  const shadowR = (cosHue * amount * 0.3).toFixed(4);
  const shadowB = (sinHue * amount * 0.3).toFixed(4);

  // Complementary: highlights get opposite hue; natural: same direction, weaker
  const highlightScale = mode === "complementary" ? 0.3 : 0.15;
  const cosHL = mode === "complementary" ? -cosHue : cosHue;
  const sinHL = mode === "complementary" ? -sinHue : sinHue;
  const highlightR = (cosHL * amount * highlightScale).toFixed(4);
  const highlightB = (sinHL * amount * highlightScale).toFixed(4);

  const midR = (pivot * -0.1).toFixed(4);

  const colorbalance = `colorbalance=rs=${shadowR}:bs=${shadowB}:rh=${highlightR}:bh=${highlightB}:rm=${midR}`;

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
