import { existsSync } from "node:fs";
import path from "node:path";
import { probe, applyPreset } from "@hance/core";
import type { PresetData } from "@hance/core";
import { parseEffectFlags, EFFECT_HELP_TEXT } from "../effect-flags";
import { createHeadlessRenderer } from "../gpu/wgpu-renderer";

const PREVIEW_HELP = `\
hance preview <input> -o <out.png> [effect flags...]

  Render a single preview frame (image) or a horizontal contact sheet of
  three frames at 25/50/75% (video). Prints absolute output path on stdout.

${EFFECT_HELP_TEXT}
`;

export interface PreviewArgs {
  input: string;
  output: string;
  overrides: PresetData;
  presetName: string;
  help: boolean;
}

export function parsePreviewArgs(argv: string[]): PreviewArgs {
  const r = parseEffectFlags(argv);
  if (r.help) return { input: "", output: "", overrides: {}, presetName: "default", help: true };
  if (r.positional.length === 0) throw new Error("preview: input file required");
  if (!r.outputArg) throw new Error("preview: -o <out.png> required");
  return {
    input: r.positional[0],
    output: r.outputArg,
    overrides: r.overrides,
    presetName: r.presetName,
    help: false,
  };
}

async function decodeImageRgba(input: string, width: number, height: number): Promise<Uint8Array> {
  const proc = Bun.spawn([
    "ffmpeg", "-i", input,
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-v", "quiet", "pipe:1",
  ], { stdout: "pipe", stderr: "pipe" });
  const bytes = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
  const code = await proc.exited;
  if (code !== 0) throw new Error(`ffmpeg decode failed for ${input}`);
  const expected = width * height * 4;
  if (bytes.length !== expected) throw new Error(`decoded ${bytes.length} bytes, expected ${expected}`);
  return bytes;
}

async function encodePng(rgba: Uint8Array, width: number, height: number, output: string): Promise<void> {
  const proc = Bun.spawn([
    "ffmpeg", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${width}x${height}`,
    "-i", "pipe:0",
    "-v", "quiet", output,
  ], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(rgba); proc.stdin.end();
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg encode failed: ${err.trim()}`);
  }
}

export async function runPreview(argv: string[]): Promise<void> {
  let parsed: PreviewArgs;
  try { parsed = parsePreviewArgs(argv); }
  catch (e) { console.error(`Error: ${(e as Error).message}`); process.exit(1); }
  if (parsed.help) { console.log(PREVIEW_HELP); return; }

  if (!existsSync(parsed.input)) {
    console.error(`Input file not found: ${parsed.input}`); process.exit(1);
  }

  const probeResult = await probe(parsed.input);
  const params = applyPreset(parsed.presetName, parsed.overrides).mergedParams;

  if (probeResult.isImage) {
    const w = probeResult.width!, h = probeResult.height!;
    const rgba = await decodeImageRgba(parsed.input, w, h);
    const renderer = await createHeadlessRenderer();
    try {
      await renderer.init(w, h, params);
      const out = await renderer.renderFrame(rgba, w, h, params);
      await encodePng(out, w, h, parsed.output);
    } finally { await renderer.close(); }
    process.stdout.write(path.resolve(parsed.output) + "\n");
    return;
  }

  // video: seek to 25/50/75%, render each frame, stitch horizontally
  const w = probeResult.width!, h = probeResult.height!;
  const duration = probeResult.duration ?? 0;
  if (!duration || duration <= 0) throw new Error(`preview: could not determine duration for ${parsed.input}`);
  const stops = [0.25, 0.5, 0.75].map((p) => p * duration);

  async function decodeFrameAt(t: number): Promise<Uint8Array> {
    const proc = Bun.spawn([
      "ffmpeg", "-ss", t.toFixed(3), "-i", parsed.input,
      "-frames:v", "1",
      "-f", "rawvideo", "-pix_fmt", "rgba",
      "-v", "quiet", "pipe:1",
    ], { stdout: "pipe", stderr: "pipe" });
    const bytes = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
    const code = await proc.exited;
    if (code !== 0) throw new Error(`ffmpeg seek/decode failed at t=${t}`);
    const expected = w * h * 4;
    if (bytes.length !== expected) throw new Error(`frame at ${t}: ${bytes.length} bytes, expected ${expected}`);
    return bytes;
  }

  const renderer = await createHeadlessRenderer();
  let stitched: Uint8Array;
  try {
    await renderer.init(w, h, params);
    const rendered: Uint8Array[] = [];
    for (const t of stops) {
      const raw = await decodeFrameAt(t);
      rendered.push(await renderer.renderFrame(raw, w, h, params));
    }
    const sheetW = w * 3;
    stitched = new Uint8Array(sheetW * h * 4);
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < 3; i++) {
        const srcRow = rendered[i].subarray(y * w * 4, (y + 1) * w * 4);
        stitched.set(srcRow, (y * sheetW + i * w) * 4);
      }
    }
  } finally { await renderer.close(); }

  await encodePng(stitched, w * 3, h, parsed.output);
  process.stdout.write(path.resolve(parsed.output) + "\n");
}
