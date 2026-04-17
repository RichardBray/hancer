import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, unlinkSync, rmSync } from "node:fs";
import path from "path";

const FIXTURES_DIR = path.join(import.meta.dir, "fixtures");
const CLI_PATH = path.join(import.meta.dir, "../../src/cli.ts");

// Helper to run hance via bun
async function runHance(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: FIXTURES_DIR,
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

// Clean up output files after tests
function cleanup(files: string[]) {
  for (const f of files) {
    const p = path.join(FIXTURES_DIR, f);
    if (existsSync(p)) unlinkSync(p);
  }
}

describe("e2e: hance", () => {
  beforeAll(async () => {
    // Generate fixtures if missing
    if (!existsSync(path.join(FIXTURES_DIR, "test.mp4"))) {
      const proc = Bun.spawn(["bash", path.join(FIXTURES_DIR, "generate-fixtures.sh")], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
    }
  });

  afterAll(() => {
    cleanup([
      "test_hanced.mp4",
      "test_hanced.png",
      "test_hanced.mov",
      "custom_output.mp4",
    ]);
  });

  it("prints help with --help", async () => {
    const { exitCode, stdout } = await runHance(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("hance <input>");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--bloom-amount");
    expect(stdout).toContain("--grain-amount");
  });

  it("exits with error on no input", async () => {
    const { exitCode, stderr } = await runHance([]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No input file");
  });

  it("exits with error on unknown flag", async () => {
    const { exitCode, stderr } = await runHance(["test.mp4", "--bogus"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Unknown flag");
  });

  it("exits with error on out-of-range flag", async () => {
    const { exitCode, stderr } = await runHance(["test.mp4", "--exposure", "10"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("must be between");
  });

  it("exits with error on missing input file", async () => {
    const { exitCode, stderr } = await runHance(["nonexistent.mp4"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not found");
  });

  it("processes an image (png) with defaults", async () => {
    cleanup(["test_hanced.png"]);
    const { exitCode, stdout, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.png"),
    ]);
    if (exitCode !== 0) console.error("FFmpeg stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("(image)");
    expect(stdout).toContain("Done.");
    expect(existsSync(path.join(FIXTURES_DIR, "test_hanced.png"))).toBe(true);
  });

  it("processes a video (mp4) with defaults", async () => {
    cleanup(["test_hanced.mp4"]);
    const { exitCode, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.mp4"),
    ]);
    if (exitCode !== 0) console.error("FFmpeg stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(existsSync(path.join(FIXTURES_DIR, "test_hanced.mp4"))).toBe(true);
  });

  it("processes a .mov file", async () => {
    cleanup(["test_hanced.mov"]);
    const { exitCode, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.mov"),
    ]);
    if (exitCode !== 0) console.error("FFmpeg stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(existsSync(path.join(FIXTURES_DIR, "test_hanced.mov"))).toBe(true);
  });

  it("respects --output flag", async () => {
    cleanup(["custom_output.mp4"]);
    const outPath = path.join(FIXTURES_DIR, "custom_output.mp4");
    const { exitCode, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.mp4"),
      "-o", outPath,
    ]);
    if (exitCode !== 0) console.error("FFmpeg stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it("processes video with custom effect parameters", async () => {
    cleanup(["test_hanced.mp4"]);
    const { exitCode, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.mp4"),
      "--exposure", "0.1",
      "--contrast", "1.2",
      "--fade", "0.3",
      "--halation-amount", "0.5",
      "--aberration", "0.5",
      "--bloom-amount", "0.3",
      "--grain-amount", "0.2",
      "--vignette-amount", "0.4",
      "--camera-shake-amount", "0.3",
      "--encode-preset", "fast",
      "--crf", "28",
    ]);
    if (exitCode !== 0) console.error("FFmpeg stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(existsSync(path.join(FIXTURES_DIR, "test_hanced.mp4"))).toBe(true);
  });

  it("processes with disabled effects via --no flags", async () => {
    cleanup(["test_hanced.png"]);
    const { exitCode, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.png"),
      "--no-halation",
      "--no-bloom",
      "--no-grain",
    ]);
    if (exitCode !== 0) console.error("FFmpeg stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(existsSync(path.join(FIXTURES_DIR, "test_hanced.png"))).toBe(true);
  });

  it("batch: processes multiple inputs with -o as output directory", async () => {
    const outDir = path.join(FIXTURES_DIR, "batch_out");
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    const { exitCode, stderr, stdout } = await runHance([
      path.join(FIXTURES_DIR, "test.mp4"),
      path.join(FIXTURES_DIR, "test.png"),
      "-o", outDir,
    ]);
    if (exitCode !== 0) console.error("stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("[1/2]");
    expect(stdout).toContain("[2/2]");
    expect(existsSync(path.join(outDir, "test_hanced.mp4"))).toBe(true);
    expect(existsSync(path.join(outDir, "test_hanced.png"))).toBe(true);
    rmSync(outDir, { recursive: true, force: true });
  });

  it("batch: continues on per-file failure and exits non-zero", async () => {
    const outDir = path.join(FIXTURES_DIR, "batch_err_out");
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    const { exitCode, stdout, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.png"),
      path.join(FIXTURES_DIR, "does_not_exist.png"),
      "-o", outDir,
    ]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("[1/2]");
    expect(stderr).toContain("Input file not found");
    expect(stderr).toContain("1/2 input(s) failed");
    expect(existsSync(path.join(outDir, "test_hanced.png"))).toBe(true);
    rmSync(outDir, { recursive: true, force: true });
  });

  it("processes with global blend", async () => {
    cleanup(["test_hanced.png"]);
    const { exitCode, stderr } = await runHance([
      path.join(FIXTURES_DIR, "test.png"),
      "--blend", "0.5",
    ]);
    if (exitCode !== 0) console.error("FFmpeg stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(existsSync(path.join(FIXTURES_DIR, "test_hanced.png"))).toBe(true);
  });
});
