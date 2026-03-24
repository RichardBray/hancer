import { describe, it, expect } from "bun:test";
import { vignetteFilter } from "../../effects/vignette";
import type { VignetteOptions } from "../../types";

const defaults: VignetteOptions = {
  enabled: true,
  amount: 0.25,
  size: 0.25,
};

describe("vignetteFilter", () => {
  it("returns passthrough when disabled", () => {
    const result = vignetteFilter("ab_out", { ...defaults, enabled: false });
    expect(result.output).toBe("vignette_out");
    expect(result.fragment).toContain("null");
  });

  it("returns fragment with vignette filter", () => {
    const result = vignetteFilter("ab_out", defaults);
    expect(result.output).toBe("vignette_out");
    expect(result.fragment).toContain("[ab_out]");
    expect(result.fragment).toContain("vignette=");
    expect(result.fragment).toContain("[vignette_out]");
  });

  it("maps amount to vignette angle", () => {
    const result = vignetteFilter("ab_out", { ...defaults, amount: 0.5 });
    expect(result.fragment).toContain("angle=");
  });
});
