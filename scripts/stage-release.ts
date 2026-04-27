import { mkdir, copyFile, rm } from "node:fs/promises";
import { existsSync, cpSync } from "node:fs";
import path from "node:path";

export function detectPlatform(platform: string, arch: string): string {
  if (platform === "darwin" && arch === "arm64") return "macos-arm64";
  if (platform === "darwin" && arch === "x64") return "macos-x64";
  if (platform === "linux" && arch === "x64") return "linux-x64";
  if (platform === "linux" && arch === "arm64") return "linux-arm64";
  throw new Error(`unsupported host: ${platform}/${arch}`);
}

async function main() {
  const root = path.resolve(import.meta.dir, "..");
  const platform = process.env.HANCE_PLATFORM ?? detectPlatform(process.platform, process.arch);
  const stageDir = path.join(root, "dist", `hance-${platform}`);

  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });

  const cli = path.join(root, "hance");
  const rustTarget = process.env.CARGO_BUILD_TARGET;
  const gpuDir = rustTarget
    ? `packages/wgpu/target/${rustTarget}/release`
    : "packages/wgpu/target/release";
  const gpu = path.join(root, gpuDir, "hance-gpu");
  if (!existsSync(cli)) throw new Error(`missing ${cli} — run bun run build first`);
  if (!existsSync(gpu)) throw new Error(`missing ${gpu} — run bun run build:wgpu first`);

  await copyFile(cli, path.join(stageDir, "hance"));
  await copyFile(gpu, path.join(stageDir, "hance-gpu"));
  await copyFile(path.join(root, "LICENSE"), path.join(stageDir, "LICENSE"));
  await copyFile(path.join(root, "README.md"), path.join(stageDir, "README.md"));

  // Bundle presets
  const presetsDir = path.join(root, "presets");
  const stagePresetsDir = path.join(stageDir, "presets");
  await mkdir(stagePresetsDir, { recursive: true });
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync(presetsDir)) {
    if (f.endsWith(".hlook") || f.endsWith(".json")) {
      await copyFile(path.join(presetsDir, f), path.join(stagePresetsDir, f));
    }
  }

  // Bundle UI dist
  const uiDistDir = path.join(root, "packages", "ui", "dist");
  const stageUiDir = path.join(stageDir, "ui");
  cpSync(uiDistDir, stageUiDir, { recursive: true });

  const { chmodSync } = await import("node:fs");
  chmodSync(path.join(stageDir, "hance"), 0o755);
  chmodSync(path.join(stageDir, "hance-gpu"), 0o755);

  if (platform.startsWith("macos")) {
    const entitlements = path.join(root, "entitlements.plist");
    for (const bin of ["hance", "hance-gpu"]) {
      const binPath = path.join(stageDir, bin);
      console.log(`codesigning ${bin}...`);
      const strip = Bun.spawnSync(["codesign", "--remove-signature", binPath]);
      if (strip.exitCode !== 0) {
        throw new Error(`codesign --remove-signature failed for ${bin}`);
      }
      const sign = Bun.spawnSync([
        "rcodesign", "sign",
        "--entitlements-xml-path", entitlements,
        binPath,
      ]);
      if (sign.exitCode !== 0) {
        throw new Error(`rcodesign sign failed for ${bin}: ${sign.stderr.toString()}`);
      }
    }
  }

  console.log(`staged: ${stageDir}`);
}

if (import.meta.main) {
  await main();
}
