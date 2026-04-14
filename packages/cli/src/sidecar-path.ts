import path from "node:path";
import { basename } from "node:path";

export interface ResolveOpts {
  execPath: string;
  env: Record<string, string | undefined>;
  devRoot?: string;
}

export function resolveSidecarPath(opts: ResolveOpts): string {
  const { execPath, env } = opts;
  if (env.HANCE_GPU) return env.HANCE_GPU;

  const execBase = basename(execPath).toLowerCase();
  const isBunRuntime = execBase === "bun" || execBase === "bun.exe";

  if (!isBunRuntime) {
    return path.join(path.dirname(execPath), "hance-gpu");
  }

  const root = opts.devRoot ?? path.resolve(import.meta.dir ?? "", "..", "..", "..");
  return path.join(root, "packages/wgpu/target/release/hance-gpu");
}

export function sidecarPath(): string {
  return resolveSidecarPath({ execPath: process.execPath, env: process.env });
}
