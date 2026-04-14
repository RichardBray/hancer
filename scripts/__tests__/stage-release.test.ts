import { describe, it, expect } from "bun:test";
import { detectPlatform } from "../stage-release";

describe("detectPlatform", () => {
  it("maps darwin arm64", () => {
    expect(detectPlatform("darwin", "arm64")).toBe("macos-arm64");
  });
  it("maps darwin x64", () => {
    expect(detectPlatform("darwin", "x64")).toBe("macos-x64");
  });
  it("maps linux x64", () => {
    expect(detectPlatform("linux", "x64")).toBe("linux-x64");
  });
  it("maps linux arm64", () => {
    expect(detectPlatform("linux", "arm64")).toBe("linux-arm64");
  });
  it("throws on unsupported", () => {
    expect(() => detectPlatform("win32", "x64")).toThrow(/unsupported/i);
  });
});
