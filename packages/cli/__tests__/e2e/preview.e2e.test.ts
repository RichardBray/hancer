import { describe, it, expect, afterAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const FIX = path.join(import.meta.dir, "fixtures");
const CLI = path.join(import.meta.dir, "../../src/cli.ts");
const VIDEO = path.join(FIX, "test.mp4");
const IMG = path.join(FIX, "test.png");
const OUT_VIDEO = path.join(FIX, "preview-video.png");
const OUT_IMG = path.join(FIX, "preview-img.png");

async function probeWh(file: string): Promise<{ w: number; h: number }> {
  const p = Bun.spawn(["ffprobe", "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file],
    { stdout: "pipe", stderr: "pipe" });
  const s = (await new Response(p.stdout).text()).trim();
  await p.exited;
  const [w, h] = s.split("x").map((x) => parseInt(x, 10));
  return { w, h };
}

async function run(args: string[]) {
  const p = Bun.spawn(["bun", "run", CLI, ...args], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(p.stdout).text();
  const stderr = await new Response(p.stderr).text();
  const code = await p.exited;
  return { code, stdout, stderr };
}

afterAll(() => {
  for (const f of [OUT_VIDEO, OUT_IMG]) if (existsSync(f)) unlinkSync(f);
});

describe("e2e: hance preview", () => {
  it("renders a single PNG for image input", async () => {
    const { code, stdout } = await run(["preview", IMG, "-o", OUT_IMG]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(path.resolve(OUT_IMG));
    expect(existsSync(OUT_IMG)).toBe(true);
  }, 60000);

  it("renders a contact sheet ~3x wider than tall for video input", async () => {
    const { code } = await run(["preview", VIDEO, "-o", OUT_VIDEO]);
    expect(code).toBe(0);
    expect(existsSync(OUT_VIDEO)).toBe(true);
    const src = await probeWh(VIDEO);
    const sheet = await probeWh(OUT_VIDEO);
    expect(sheet.w).toBe(src.w * 3);
    expect(sheet.h).toBe(src.h);
  }, 90000);

  it("prints only the absolute output path on stdout", async () => {
    const { stdout } = await run(["preview", IMG, "-o", OUT_IMG]);
    expect(stdout.trim().split("\n")).toHaveLength(1);
    expect(path.isAbsolute(stdout.trim())).toBe(true);
  }, 60000);
});
