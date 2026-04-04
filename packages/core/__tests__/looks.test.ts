import { describe, test, expect } from "bun:test";
import { loadPreset, builtinPresetsDir } from "../src/presets";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("look file loading", () => {
  test("builtinPresetsDir contains .hlook files", () => {
    const dir = builtinPresetsDir();
    expect(existsSync(join(dir, "default.hlook"))).toBe(true);
  });

  test("loadPreset loads .hlook files", () => {
    const data = loadPreset("default");
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
  });

  test("loadPreset loads heavy look with .hlook metadata wrapper", () => {
    const data = loadPreset("heavy");
    expect(data.name).toBe("Heavy");
    const params = data.params as Record<string, unknown>;
    expect(params.exposure).toBe(0.1);
  });
});
