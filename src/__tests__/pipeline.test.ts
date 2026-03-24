import { describe, it, expect } from "bun:test";
import { buildFilterGraph } from "../pipeline";
import type { FilmOptions } from "../types";

const defaults: FilmOptions = {
  input: "test.mp4",
  output: "test_openhanced.mp4",
  encodePreset: "medium",
  crf: 18,
  blend: 1,
  colorSettings: {
    enabled: true, exposure: 0, contrast: 1, highlights: 0, fade: 0,
    whiteBalance: 6500, tint: 0, subtractiveSat: 1, richness: 1, bleachBypass: 0,
  },
  halation: { enabled: true, amount: 0.25, radius: 4, saturation: 1, hue: 0.5, highlightsOnly: true },
  aberration: { enabled: true, amount: 0.3 },
  bloom: { enabled: true, amount: 0.25, radius: 10 },
  grain: { enabled: true, amount: 0.125, size: 0, softness: 0.1, saturation: 0.3, imageDefocus: 1 },
  vignette: { enabled: true, amount: 0.25, size: 0.25 },
  splitTone: { enabled: true, mode: "natural", protectNeutrals: false, amount: 0.5, hueAngle: 20, pivot: 0.3 },
  cameraShake: { enabled: true, amount: 0.25, rate: 0.5 },
};

describe("buildFilterGraph", () => {
  it("chains all effects for video", () => {
    const { graph, finalLabel } = buildFilterGraph(defaults, false);
    expect(graph).toContain("[0:v]");
    expect(graph).toContain("[color_out]");
    expect(graph).toContain("[halation_out]");
    expect(graph).toContain("[ab_out]");
    expect(graph).toContain("[bloom_out]");
    expect(graph).toContain("[grain_out]");
    expect(graph).toContain("[vignette_out]");
    expect(graph).toContain("[splittone_out]");
    expect(graph).toContain("[shake_out]");
    expect(finalLabel).toBe("shake_out");
  });

  it("skips camera shake for image input", () => {
    const { graph, finalLabel } = buildFilterGraph(defaults, true);
    expect(graph).not.toContain("shake_out");
    expect(finalLabel).toBe("splittone_out");
  });

  it("applies global blend when blend < 1", () => {
    const opts = { ...defaults, blend: 0.5 };
    const { graph, finalLabel } = buildFilterGraph(opts, true);
    expect(graph).toContain("blend=");
    expect(finalLabel).toBe("blend_out");
  });

  it("skips global blend when blend is 1", () => {
    const { graph } = buildFilterGraph(defaults, true);
    expect(graph).not.toContain("blend_out");
  });

  it("skips disabled effects", () => {
    const opts = { ...defaults, halation: { ...defaults.halation, enabled: false } };
    const { graph } = buildFilterGraph(opts, false);
    expect(graph).toContain("[halation_out]"); // still labeled but passthrough
  });
});
