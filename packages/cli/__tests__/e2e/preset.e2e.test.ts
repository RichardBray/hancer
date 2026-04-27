import { describe, it, expect, afterAll } from "bun:test";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const FIX = path.join(import.meta.dir, "fixtures");
const CLI = path.join(import.meta.dir, "../../src/cli.ts");
const IMG = path.join(FIX, "test.png");
const NAME = "match-look-e2e-test";
const PRESET_FILE = path.join(homedir(), ".hance", "presets", `${NAME}.hlook`);
const OUT_DIRECT = path.join(FIX, "direct.png");
const OUT_VIA_PRESET = path.join(FIX, "viapreset.png");

async function run(args: string[]) {
  const p = Bun.spawn(["bun", "run", CLI, ...args], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(p.stdout).text();
  const stderr = await new Response(p.stderr).text();
  const code = await p.exited;
  return { code, stdout, stderr };
}

afterAll(() => {
  for (const f of [PRESET_FILE, OUT_DIRECT, OUT_VIA_PRESET]) if (existsSync(f)) unlinkSync(f);
});

describe("e2e: hance preset", () => {
  it("save writes a valid .hlook file", async () => {
    if (existsSync(PRESET_FILE)) unlinkSync(PRESET_FILE);
    const { code, stdout } = await run(["preset", "save", NAME, "--exposure", "0.5"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(path.resolve(PRESET_FILE));
    const data = JSON.parse(readFileSync(PRESET_FILE, "utf-8"));
    expect(data.params.exposure).toBe(0.5);
  });

  it("save refuses to overwrite without --force", async () => {
    const { code, stderr } = await run(["preset", "save", NAME, "--exposure", "0.6"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/already exists/);
  });

  it("save overwrites with --force", async () => {
    const { code } = await run(["preset", "save", NAME, "--exposure", "0.6", "--force"]);
    expect(code).toBe(0);
  });

  it("list includes saved preset", async () => {
    const { code, stdout } = await run(["preset", "list"]);
    expect(code).toBe(0);
    expect(stdout.split("\n")).toContain(NAME);
  });

  it("rejects names with path separators", async () => {
    const { code, stderr } = await run(["preset", "save", "../evil", "--exposure", "0.1"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/path separators/);
  });

  it("preset render matches direct flag render", async () => {
    if (existsSync(OUT_DIRECT)) unlinkSync(OUT_DIRECT);
    if (existsSync(OUT_VIA_PRESET)) unlinkSync(OUT_VIA_PRESET);
    const a = await run([IMG, "-o", OUT_DIRECT, "--exposure", "0.6"]);
    const b = await run([IMG, "-o", OUT_VIA_PRESET, "--preset", NAME]);
    expect(a.code).toBe(0); expect(b.code).toBe(0);
    const ha = Bun.hash(readFileSync(OUT_DIRECT));
    const hb = Bun.hash(readFileSync(OUT_VIA_PRESET));
    expect(ha).toBe(hb);
  }, 90000);
});
