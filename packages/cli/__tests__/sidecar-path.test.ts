import { describe, it, expect } from "bun:test";
import { resolveSidecarPath } from "../src/sidecar-path";
import { join } from "node:path";

describe("resolveSidecarPath", () => {
  it("prefers HANCE_GPU env override", () => {
    expect(resolveSidecarPath({ execPath: "/whatever/hance", env: { HANCE_GPU: "/custom/hance-gpu" } }))
      .toBe("/custom/hance-gpu");
  });

  it("looks next to execPath when run as a compiled binary", () => {
    expect(resolveSidecarPath({ execPath: "/opt/hance/bin/hance", env: {} }))
      .toBe(join("/opt/hance/bin", "hance-gpu"));
  });

  it("falls back to the cargo target dir when execPath is bun", () => {
    const p = resolveSidecarPath({ execPath: "/usr/local/bin/bun", env: {}, devRoot: "/repo" });
    expect(p).toBe(join("/repo", "packages/wgpu/target/release/hance-gpu"));
  });
});
