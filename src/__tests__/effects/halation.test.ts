import { describe, it, expect } from "bun:test";
import { halationFilter } from "../../effects/halation";

describe("halationFilter", () => {
  it("returns fragment with split, gblur, and blend", () => {
    const result = halationFilter("graded", {
      intensity: 0.6,
      radius: 51,
      threshold: 180,
      warmth: 0.7,
    });
    expect(result.output).toBe("halation_out");
    expect(result.fragment).toContain("[graded]");
    expect(result.fragment).toContain("split=2");
    expect(result.fragment).toContain("gblur=");
    expect(result.fragment).toContain("blend=");
  });

  it("enforces odd radius", () => {
    const result = halationFilter("graded", {
      intensity: 0.6,
      radius: 50,
      threshold: 180,
      warmth: 0.7,
    });
    expect(result.fragment).toContain("gblur=sigma=51");
  });

  it("uses warmth for tinting curves", () => {
    const result = halationFilter("graded", {
      intensity: 0.6,
      radius: 51,
      threshold: 180,
      warmth: 1.0,
    });
    expect(result.fragment).toContain("curves=");
  });
});
