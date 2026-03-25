import type { FilterResult, AberrationOptions } from "../types";
import { passthrough } from "./utils";

export function aberrationFilter(input: string, options: AberrationOptions): FilterResult {
  if (!options.enabled) return passthrough(input, "ab_out");

  const offset = options.amount * 0.02;

  if (offset === 0) {
    const fragment = `[${input}]format=gbrp,format=yuv444p[ab_out]`;
    return { fragment, output: "ab_out" };
  }

  const scaleFactor = (1 + offset).toFixed(6);
  const scaleFactorInv = (1 - offset).toFixed(6);

  const fragment = [
    `[${input}]format=gbrp,split=3[ab_r_src][ab_g_src][ab_b_src];`,
    `[ab_r_src]extractplanes=r[ab_r];`,
    `[ab_g_src]extractplanes=g[ab_g];`,
    `[ab_b_src]extractplanes=b[ab_b];`,
    `[ab_r]scale=iw*${scaleFactor}:ih*${scaleFactor},crop=iw/${scaleFactor}:ih/${scaleFactor},setsar=1[ab_r_crop];`,
    `[ab_g]scale=iw:ih,setsar=1[ab_g_ref];`,
    `[ab_r_crop][ab_g_ref]scale2ref[ab_r_shift][ab_g_sized];`,
    `[ab_r_shift]setsar=1[ab_r_fixed];`,
    `[ab_g_sized]setsar=1[ab_g_fixed];`,
    `[ab_b]scale=iw*${scaleFactorInv}:ih*${scaleFactorInv},pad=iw/${scaleFactorInv}:ih/${scaleFactorInv}:(ow-iw)/2:(oh-ih)/2,setsar=1[ab_b_pad];`,
    `[ab_b_pad][ab_g_fixed]scale2ref[ab_b_shift][ab_g_final];`,
    `[ab_b_shift]setsar=1[ab_b_fixed];`,
    `[ab_g_final]setsar=1[ab_g_final_fixed];`,
    `[ab_g_final_fixed][ab_b_fixed][ab_r_fixed]mergeplanes=0x001020:gbrp,setsar=1,format=yuv444p[ab_out]`,
  ].join("");

  return { fragment, output: "ab_out" };
}
