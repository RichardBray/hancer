import { describe, it, expect } from "bun:test";
import { aberrationFilter } from "../../effects/aberration";

describe("aberrationFilter", () => {
  it("returns passthrough when disabled", () => {
    const result = aberrationFilter("halation_out", { enabled: false, amount: 0.3 });
    expect(result.output).toBe("ab_out");
    expect(result.fragment).toContain("null");
  });

  it("returns fragment with extractplanes and mergeplanes", () => {
    const result = aberrationFilter("halation_out", { enabled: true, amount: 0.3 });
    expect(result.output).toBe("ab_out");
    expect(result.fragment).toContain("[halation_out]");
    expect(result.fragment).toContain("extractplanes=");
    expect(result.fragment).toContain("mergeplanes=");
  });

  it("normalizes SAR on intermediate branches so image exports do not fail", () => {
    const result = aberrationFilter("halation_out", { enabled: true, amount: 0.3 });
    expect(result.fragment).toContain("setsar=1[ab_r_crop]");
    expect(result.fragment).toContain("setsar=1[ab_g_ref]");
    expect(result.fragment).toContain("setsar=1[ab_b_pad]");
    expect(result.fragment).toContain("mergeplanes=0x001020:gbrp,setsar=1,format=yuv444p[ab_out]");
  });

  it("handles zero amount gracefully", () => {
    const result = aberrationFilter("halation_out", { enabled: true, amount: 0 });
    expect(result.output).toBe("ab_out");
    expect(result.fragment).toContain("format=");
  });
});
