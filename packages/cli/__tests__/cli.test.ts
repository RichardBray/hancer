import { describe, it, expect } from "bun:test";
import { parseArgs, getDefaultOutput, isSubcommand } from "../src/cli";

describe("parseArgs", () => {
  it("parses input file as first positional arg", () => {
    const result = parseArgs(["input.mp4"]);
    expect(result.inputs).toEqual(["input.mp4"]);
  });

  it("parses --output flag", () => {
    const result = parseArgs(["input.mp4", "--output", "out.mp4"]);
    expect(result.outputs).toEqual(["out.mp4"]);
  });

  it("parses -o shorthand", () => {
    const result = parseArgs(["input.mp4", "-o", "out.mp4"]);
    expect(result.outputs).toEqual(["out.mp4"]);
  });

  it("collects multiple positional args as inputs", () => {
    const result = parseArgs(["a.mov", "b.mov", "c.mov"]);
    expect(result.inputs).toEqual(["a.mov", "b.mov", "c.mov"]);
  });

  it("defaults outputs to <stem>_hanced<ext> next to each input when -o omitted", () => {
    const result = parseArgs(["a.mov", "b.mov"]);
    expect(result.outputs).toEqual(["a_hanced.mov", "b_hanced.mov"]);
  });

  it("treats -o as output directory when multiple inputs given", () => {
    const result = parseArgs(["dir/a.mov", "dir/b.mov", "-o", "./out"]);
    expect(result.outputs).toEqual(["out/a_hanced.mov", "out/b_hanced.mov"]);
  });

  it("keeps -o as file path with a single input", () => {
    const result = parseArgs(["a.mov", "-o", "custom.mp4"]);
    expect(result.outputs).toEqual(["custom.mp4"]);
  });

  it("parses color settings flags", () => {
    const result = parseArgs(["input.mp4", "--exposure", "0.12", "--contrast", "1.2"]);
    expect(result.colorSettings.exposure).toBe(0.12);
    expect(result.colorSettings.contrast).toBe(1.2);
  });

  it("parses halation flags with new names", () => {
    const result = parseArgs(["input.mp4", "--halation-amount", "0.5"]);
    expect(result.halation.amount).toBe(0.5);
  });

  it("parses --no-halation to disable", () => {
    const result = parseArgs(["input.mp4", "--no-halation"]);
    expect(result.halation.enabled).toBe(false);
  });

  it("parses --blend for global blend", () => {
    const result = parseArgs(["input.mp4", "--blend", "0.5"]);
    expect(result.blend).toBe(0.5);
  });

  it("parses new effect flags", () => {
    const result = parseArgs([
      "input.mp4",
      "--bloom-amount", "0.3",
      "--grain-amount", "0.2",
      "--vignette-amount", "0.4",
    ]);
    expect(result.bloom.amount).toBe(0.3);
    expect(result.grain.amount).toBe(0.2);
    expect(result.vignette.amount).toBe(0.4);
  });

  it("parses --preset to load a named preset", () => {
    const result = parseArgs(["input.mp4", "--preset", "subtle"]);
    expect(result.halation.amount).toBe(0.1);
  });

  it("CLI flags override preset values", () => {
    const result = parseArgs(["input.mp4", "--preset", "subtle", "--aberration", "0.8"]);
    expect(result.aberration.amount).toBe(0.8);
  });

  it("parses --encode-preset for FFmpeg speed", () => {
    const result = parseArgs(["input.mp4", "--encode-preset", "fast"]);
    expect(result.encodePreset).toBe("fast");
  });

  it("throws on unknown flag", () => {
    expect(() => parseArgs(["input.mp4", "--unknown"])).toThrow();
  });

  it("throws on out-of-range value", () => {
    expect(() => parseArgs(["input.mp4", "--exposure", "10"])).toThrow();
  });

  it("throws with no input", () => {
    expect(() => parseArgs([])).toThrow();
  });

  it("detects --help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result.help).toBe(true);
  });

  it("parses --export low", () => {
    const result = parseArgs(["input.mp4", "--export", "low"]);
    expect(result.codec).toBe("h264");
    expect(result.crf).toBe(23);
    expect(result.encodePreset).toBe("fast");
  });

  it("parses --export high", () => {
    const result = parseArgs(["input.mp4", "--export", "high"]);
    expect(result.codec).toBe("h265");
    expect(result.crf).toBe(16);
    expect(result.encodePreset).toBe("slow");
    expect(result.pixelFormat).toBe("yuv420p10le");
  });

  it("parses --export medium and returns correct pixelFormat", () => {
    const result = parseArgs(["input.mp4", "--export", "medium"]);
    expect(result.codec).toBe("h264");
    expect(result.crf).toBe(18);
    expect(result.encodePreset).toBe("medium");
    expect(result.pixelFormat).toBe("yuv420p");
  });

  it("--export with individual override: codec wins", () => {
    const result = parseArgs(["input.mp4", "--export", "high", "--codec", "h264"]);
    expect(result.codec).toBe("h264");
    expect(result.crf).toBe(16);
    expect(result.encodePreset).toBe("slow");
  });

  it("--export with individual override: crf wins", () => {
    const result = parseArgs(["input.mp4", "--export", "high", "--crf", "20"]);
    expect(result.crf).toBe(20);
  });

  it("throws on invalid --export value", () => {
    expect(() => parseArgs(["input.mp4", "--export", "ultra"])).toThrow();
  });
});

describe("subcommand routing", () => {
  it("isSubcommand detects ui command", () => {
    expect(isSubcommand(["ui"])).toBe(true);
    expect(isSubcommand(["ui", "--port", "3000"])).toBe(true);
    expect(isSubcommand(["video.mp4"])).toBe(false);
    expect(isSubcommand(["--help"])).toBe(false);
  });
});

describe("getDefaultOutput", () => {
  it("appends _hanced before extension", () => {
    expect(getDefaultOutput("video.mp4")).toBe("video_hanced.mp4");
  });

  it("handles .mov files", () => {
    expect(getDefaultOutput("clip.mov")).toBe("clip_hanced.mov");
  });

  it("handles paths with directories", () => {
    expect(getDefaultOutput("/path/to/video.mp4")).toBe("/path/to/video_hanced.mp4");
  });
});
