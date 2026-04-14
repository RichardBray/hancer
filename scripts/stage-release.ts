import { mkdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
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
  const gpu = path.join(root, "packages/wgpu/target/release/hance-gpu");
  if (!existsSync(cli)) throw new Error(`missing ${cli} — run bun run build first`);
  if (!existsSync(gpu)) throw new Error(`missing ${gpu} — run bun run build:wgpu first`);

  await copyFile(cli, path.join(stageDir, "hance"));
  await copyFile(gpu, path.join(stageDir, "hance-gpu"));
  await copyFile(path.join(root, "LICENSE"), path.join(stageDir, "LICENSE"));
  await copyFile(path.join(root, "README.md"), path.join(stageDir, "README.md"));

  const { chmodSync } = await import("node:fs");
  chmodSync(path.join(stageDir, "hance"), 0o755);
  chmodSync(path.join(stageDir, "hance-gpu"), 0o755);

  console.log(`staged: ${stageDir}`);
}

if (import.meta.main) {
  await main();
}
