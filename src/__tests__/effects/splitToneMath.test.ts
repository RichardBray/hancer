import { describe, expect, it } from "bun:test";
import { getSplitToneTintValues } from "../../effects/splitToneMath";

describe("getSplitToneTintValues", () => {
  it("matches the complementary FFmpeg coefficients used by the filter graph", () => {
    const result = getSplitToneTintValues({
      amount: 0.52,
      hueAngle: 105,
      mode: "complementary",
      pivot: 0.23,
    });

    expect(result.shadowR.toFixed(4)).toBe("-0.0404");
    expect(result.shadowB.toFixed(4)).toBe("0.1507");
    expect(result.highlightR.toFixed(4)).toBe("0.0404");
    expect(result.highlightB.toFixed(4)).toBe("-0.1507");
    expect(result.midR.toFixed(4)).toBe("-0.0230");
  });

  it("uses a weaker same-direction highlight tint in natural mode", () => {
    const result = getSplitToneTintValues({
      amount: 0.5,
      hueAngle: 20,
      mode: "natural",
      pivot: 0.3,
    });

    expect(result.highlightR).toBeGreaterThan(0);
    expect(result.highlightB).toBeGreaterThan(0);
    expect(Math.abs(result.highlightR)).toBeLessThan(Math.abs(result.shadowR));
    expect(Math.abs(result.highlightB)).toBeLessThan(Math.abs(result.shadowB));
  });
});
