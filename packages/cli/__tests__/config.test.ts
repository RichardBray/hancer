import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { configToArgv, loadConfig, findLocalConfig } from "../src/config";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

describe("configToArgv", () => {
  test("converts string values to flag pairs", () => {
    expect(configToArgv({ codec: "prores", preset: "cinematic" })).toEqual([
      "--codec", "prores",
      "--preset", "cinematic",
    ]);
  });

  test("converts numeric values to flag pairs", () => {
    expect(configToArgv({ crf: 22, blend: 0.8 })).toEqual([
      "--crf", "22",
      "--blend", "0.8",
    ]);
  });

  test("converts boolean true to standalone flag", () => {
    expect(configToArgv({ "no-grain": true })).toEqual(["--no-grain"]);
  });

  test("skips false and undefined values", () => {
    expect(configToArgv({ "no-grain": false })).toEqual([]);
  });

  test("handles empty config", () => {
    expect(configToArgv({})).toEqual([]);
  });
});

describe("findLocalConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `hance-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("finds config in the given directory", () => {
    const configPath = path.join(tempDir, ".hancerc.json");
    writeFileSync(configPath, '{"codec": "prores"}');
    expect(findLocalConfig(tempDir)).toBe(configPath);
  });

  test("walks up to find config in parent directory", () => {
    const child = path.join(tempDir, "sub", "deep");
    mkdirSync(child, { recursive: true });
    const configPath = path.join(tempDir, ".hancerc.json");
    writeFileSync(configPath, '{"codec": "prores"}');
    expect(findLocalConfig(child)).toBe(configPath);
  });

  test("returns null when no config exists", () => {
    expect(findLocalConfig(tempDir)).toBeNull();
  });
});

describe("loadConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `hance-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("loads config from directory", async () => {
    writeFileSync(path.join(tempDir, ".hancerc.json"), '{"codec": "prores", "crf": 12}');
    const { config, source } = await loadConfig(tempDir);
    expect(config.codec).toBe("prores");
    expect(config.crf).toBe(12);
    expect(source).toBe(path.join(tempDir, ".hancerc.json"));
  });

  test("returns empty config when no file exists", async () => {
    const { config, source } = await loadConfig(tempDir);
    expect(config).toEqual({});
    expect(source).toBeNull();
  });

  test("warns and skips invalid JSON", async () => {
    writeFileSync(path.join(tempDir, ".hancerc.json"), "not json");
    const { config, source } = await loadConfig(tempDir);
    expect(config).toEqual({});
    expect(source).toBeNull();
  });

  test("warns and skips non-object JSON (array)", async () => {
    writeFileSync(path.join(tempDir, ".hancerc.json"), "[1, 2, 3]");
    const { config, source } = await loadConfig(tempDir);
    expect(config).toEqual({});
    expect(source).toBeNull();
  });
});
