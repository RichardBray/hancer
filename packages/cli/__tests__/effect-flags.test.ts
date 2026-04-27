import { describe, it, expect } from "bun:test";
import { parseEffectFlags } from "../src/effect-flags";

describe("parseEffectFlags", () => {
  it("parses numeric effect flags into overrides", () => {
    const r = parseEffectFlags(["--exposure", "0.5", "--contrast", "1.2"]);
    expect(r.overrides["exposure"]).toBe(0.5);
    expect(r.overrides["contrast"]).toBe(1.2);
  });

  it("parses boolean disable flags", () => {
    const r = parseEffectFlags(["--no-grain", "--no-halation"]);
    expect(r.overrides["no-grain"]).toBe(true);
    expect(r.overrides["no-halation"]).toBe(true);
  });

  it("rejects unknown flags", () => {
    expect(() => parseEffectFlags(["--bogus", "1"])).toThrow(/Unknown flag/);
  });

  it("validates ranges", () => {
    expect(() => parseEffectFlags(["--exposure", "9"])).toThrow(/between -2 and 2/);
  });

  it("captures --preset and -o without consuming them as effect flags", () => {
    const r = parseEffectFlags(["--preset", "kodak", "-o", "out.png", "--exposure", "0.1"]);
    expect(r.presetName).toBe("kodak");
    expect(r.outputArg).toBe("out.png");
    expect(r.overrides["exposure"]).toBe(0.1);
  });

  it("collects positional args separately", () => {
    const r = parseEffectFlags(["input.mp4", "--exposure", "0.2"]);
    expect(r.positional).toEqual(["input.mp4"]);
  });

  it("parses export-shape flags", () => {
    const r = parseEffectFlags([
      "--export", "high",
      "--codec", "prores",
      "--crf", "18",
      "--encode-preset", "slow",
      "--blend", "0.5",
    ]);
    expect(r.exportPreset).toBe("high");
    expect(r.overrideCodec).toBe("prores");
    expect(r.overrideCrf).toBe(18);
    expect(r.overrideEncodePreset).toBe("slow");
    expect(r.overrides["blend"]).toBe(0.5);
  });

  it("rejects invalid --codec / --export / --encode-preset values", () => {
    expect(() => parseEffectFlags(["--codec", "av1"])).toThrow(/--codec/);
    expect(() => parseEffectFlags(["--export", "ultra"])).toThrow(/--export/);
    expect(() => parseEffectFlags(["--encode-preset", "turbo"])).toThrow(/--encode-preset/);
  });
});
