import { describe, expect, test } from "bun:test";
import { configToArgv } from "../src/config";

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
