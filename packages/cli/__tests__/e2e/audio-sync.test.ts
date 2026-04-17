import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const FIXTURES_DIR = path.join(import.meta.dir, "fixtures");
const CLI_PATH = path.join(import.meta.dir, "../../src/cli.ts");
const INPUT = path.join(FIXTURES_DIR, "test_with_audio.mp4");
const OUTPUT = path.join(FIXTURES_DIR, "test_with_audio_hanced.mp4");

async function probeStartTime(file: string, streamSelector: string): Promise<number> {
  const proc = Bun.spawn(
    ["ffprobe", "-v", "error", "-select_streams", streamSelector,
      "-show_entries", "stream=start_time", "-of", "default=nw=1:nk=1", file],
    { stdout: "pipe", stderr: "pipe" },
  );
  const out = (await new Response(proc.stdout).text()).trim();
  await proc.exited;
  const n = parseFloat(out);
  if (!Number.isFinite(n)) {
    throw new Error(`ffprobe returned non-numeric start_time for ${streamSelector}: ${JSON.stringify(out)}`);
  }
  return n;
}

describe("e2e: audio/video sync", () => {
  beforeAll(async () => {
    if (!existsSync(INPUT)) {
      const proc = Bun.spawn(["bash", path.join(FIXTURES_DIR, "generate-fixtures.sh")], {
        stdout: "pipe", stderr: "pipe",
      });
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0) throw new Error(`generate-fixtures.sh failed (exit ${exitCode}): ${stderr}`);
    }
  });

  afterAll(() => {
    if (existsSync(OUTPUT)) unlinkSync(OUTPUT);
  });

  it("video and audio streams start at aligned PTS (no drift)", async () => {
    if (existsSync(OUTPUT)) unlinkSync(OUTPUT);
    const proc = Bun.spawn(
      ["bun", "run", CLI_PATH, INPUT, "-o", OUTPUT, "--no-grain", "--no-camera-shake"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) console.error("hance stderr:", stderr);
    expect(exitCode).toBe(0);
    expect(existsSync(OUTPUT)).toBe(true);

    const videoStart = await probeStartTime(OUTPUT, "v:0");
    const audioStart = await probeStartTime(OUTPUT, "a:0");
    // With the drift bug, audio start_time lagged video by the AAC priming
    // delay (~0.02s+). Require sub-frame alignment at 25fps (<10ms).
    expect(Math.abs(videoStart - audioStart)).toBeLessThan(0.01);
  }, 60000);
});
