import { describe, it, expect } from "bun:test";
import { parsePreviewArgs } from "../../src/commands/preview";

describe("parsePreviewArgs", () => {
  it("requires an input", () => {
    expect(() => parsePreviewArgs([])).toThrow(/input/i);
  });
  it("requires -o", () => {
    expect(() => parsePreviewArgs(["in.png"])).toThrow(/-o/);
  });
  it("returns input, output, and overrides", () => {
    const r = parsePreviewArgs(["in.png", "-o", "out.png", "--exposure", "0.5"]);
    expect(r.input).toBe("in.png");
    expect(r.output).toBe("out.png");
    expect(r.overrides["exposure"]).toBe(0.5);
  });
  it("supports --help", () => {
    const r = parsePreviewArgs(["--help"]);
    expect(r.help).toBe(true);
  });
});
