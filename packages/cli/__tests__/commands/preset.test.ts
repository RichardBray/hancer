import { describe, it, expect } from "bun:test";
import { validatePresetName, parsePresetSaveArgs } from "../../src/commands/preset";

describe("validatePresetName", () => {
  it("rejects path separators", () => { expect(() => validatePresetName("a/b")).toThrow(); });
  it("rejects backslashes", () => { expect(() => validatePresetName("a\\b")).toThrow(); });
  it("rejects leading dot", () => { expect(() => validatePresetName(".hidden")).toThrow(); });
  it("rejects whitespace", () => { expect(() => validatePresetName("a b")).toThrow(); });
  it("rejects empty", () => { expect(() => validatePresetName("")).toThrow(); });
  it("accepts kebab and underscore", () => {
    expect(() => validatePresetName("kodak-2393_v1")).not.toThrow();
  });
});

describe("parsePresetSaveArgs", () => {
  it("parses name and effect overrides", () => {
    const r = parsePresetSaveArgs(["my-look", "--exposure", "0.5"]);
    expect(r.name).toBe("my-look");
    expect(r.overrides["exposure"]).toBe(0.5);
    expect(r.force).toBe(false);
  });
  it("parses --force", () => {
    const r = parsePresetSaveArgs(["x", "--force"]);
    expect(r.force).toBe(true);
  });
});
