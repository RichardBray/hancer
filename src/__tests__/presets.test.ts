import { describe, it, expect } from "bun:test";
import { loadPreset, applyPreset } from "../presets";

describe("loadPreset", () => {
  it("loads the built-in default preset", () => {
    const data = loadPreset("default");
    expect(data).toBeDefined();
    expect(data["aberration"]).toBe(0.3);
    expect(data["halation-amount"]).toBe(0.25);
  });

  it("loads a named built-in preset", () => {
    const data = loadPreset("subtle");
    expect(data).toBeDefined();
    expect(data["halation-amount"]).toBe(0.1);
  });

  it("throws for unknown preset", () => {
    expect(() => loadPreset("nonexistent")).toThrow(/not found/i);
  });
});

describe("applyPreset", () => {
  it("returns full effect options from default preset with no overrides", () => {
    const opts = applyPreset("default", {});
    expect(opts.colorSettings.exposure).toBe(0);
    expect(opts.colorSettings.contrast).toBe(1);
    expect(opts.halation.amount).toBe(0.25);
    expect(opts.aberration.amount).toBe(0.3);
    expect(opts.bloom.amount).toBe(0.25);
    expect(opts.grain.amount).toBe(0.125);
    expect(opts.vignette.amount).toBe(0.25);
    expect(opts.cameraShake.amount).toBe(0.25);
    expect(opts.encodePreset).toBe("medium");
    expect(opts.crf).toBe(18);
    expect(opts.blend).toBe(1);
  });

  it("applies CLI overrides on top of preset", () => {
    const opts = applyPreset("default", { "exposure": 0.5, "aberration": 0.8 });
    expect(opts.colorSettings.exposure).toBe(0.5);
    expect(opts.aberration.amount).toBe(0.8);
    // Non-overridden values stay at preset defaults
    expect(opts.halation.amount).toBe(0.25);
  });

  it("merges named preset over default then applies overrides", () => {
    const opts = applyPreset("subtle", { "aberration": 0.5 });
    expect(opts.halation.amount).toBe(0.1); // from subtle
    expect(opts.aberration.amount).toBe(0.5); // from CLI override
    expect(opts.vignette.amount).toBe(0.1); // from subtle
  });

  it("handles boolean disable overrides", () => {
    const opts = applyPreset("default", { "no-halation": true });
    expect(opts.halation.enabled).toBe(false);
  });
});
