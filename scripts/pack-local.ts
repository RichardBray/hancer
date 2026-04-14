import path from "node:path";
import { detectPlatform } from "./stage-release";

const root = path.resolve(import.meta.dir, "..");
const platform = process.env.HANCE_PLATFORM ?? detectPlatform(process.platform, process.arch);
const tarball = `hance-${platform}.tar.gz`;

const proc = Bun.spawn(
  ["tar", "-czf", tarball, "-C", "dist", `hance-${platform}`],
  { cwd: root, stdout: "inherit", stderr: "inherit" }
);
const code = await proc.exited;
if (code !== 0) process.exit(code);
console.log(`packed: ${tarball}`);
