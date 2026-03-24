import type { FilterResult, CameraShakeOptions } from "../types";
import { passthrough } from "./utils";

export function cameraShakeFilter(input: string, options: CameraShakeOptions): FilterResult {
  if (!options.enabled || options.amount === 0) return passthrough(input, "shake_out");

  const { amount, rate } = options;
  const pad = Math.ceil(amount * 6);
  const amp = (amount * 3).toFixed(4);

  // Base periods are primes; rate scales them inversely
  const rateScale = Math.max(0.1, rate);
  const period1 = Math.round(37 / rateScale);
  const period2 = Math.round(53 / rateScale);

  const fragment = [
    `[${input}]crop=`,
    `w=iw-${pad}:`,
    `h=ih-${pad}:`,
    `x=${pad}/2+${amp}*sin(n/${period1}):`,
    `y=${pad}/2+${amp}*sin(n/${period2}+1.3),`,
    `scale=iw+${pad}:ih+${pad}[shake_out]`,
  ].join("");

  return { fragment, output: "shake_out" };
}
