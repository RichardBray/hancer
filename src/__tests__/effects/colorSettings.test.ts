import { describe, it, expect } from "bun:test";
import { colorSettingsFilter } from "../../effects/colorSettings";
import type { ColorSettingsOptions } from "../../types";

const defaults: ColorSettingsOptions = {
  enabled: true,
  exposure: 0,
  contrast: 1,
  highlights: 0,
  fade: 0,
  whiteBalance: 6500,
  tint: 0,
  subtractiveSat: 1,
  richness: 1,
  bleachBypass: 0,
};

describe("colorSettingsFilter", () => {
  it("returns passthrough when disabled", () => {
    const result = colorSettingsFilter("0:v", { ...defaults, enabled: false });
    expect(result.output).toBe("color_out");
    expect(result.fragment).toContain("null");
  });

  it("returns fragment with eq filter for exposure and contrast", () => {
    const result = colorSettingsFilter("0:v", { ...defaults, exposure: 0.12, contrast: 1.2 });
    expect(result.output).toBe("color_out");
    expect(result.fragment).toContain("[0:v]");
    expect(result.fragment).toContain("eq=");
    expect(result.fragment).toContain("[color_out]");
  });

  it("applies white balance via colortemperature filter", () => {
    const result = colorSettingsFilter("0:v", { ...defaults, whiteBalance: 5000 });
    expect(result.fragment).toContain("colortemperature=");
    expect(result.fragment).toContain("5000");
  });

  it("applies saturation via eq filter", () => {
    const result = colorSettingsFilter("0:v", { ...defaults, subtractiveSat: 1.2 });
    expect(result.fragment).toContain("saturation=");
  });

  it("applies fade as brightness boost and contrast reduction", () => {
    const result = colorSettingsFilter("0:v", { ...defaults, fade: 0.3 });
    expect(result.fragment).toContain("contrast=");
    expect(result.fragment).toContain("brightness=");
  });

  it("applies bleach bypass as desaturation blended with contrast", () => {
    const result = colorSettingsFilter("0:v", { ...defaults, bleachBypass: 0.5 });
    expect(result.fragment).toContain("blend=");
  });

  it("accepts custom input label", () => {
    const result = colorSettingsFilter("prev_out", defaults);
    expect(result.fragment).toContain("[prev_out]");
  });
});
