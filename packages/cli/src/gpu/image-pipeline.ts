import { createHeadlessRenderer } from "./wgpu-renderer";

export async function decodeImageRgba(input: string, width: number, height: number): Promise<Uint8Array> {
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

export async function encodeRgbaToFile(rgba: Uint8Array, width: number, height: number, output: string): Promise<void> {
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

export async function renderImage(
  input: string,
  output: string,
  width: number,
  height: number,
  params: Record<string, unknown>,
): Promise<void> {
  const rgba = await decodeImageRgba(input, width, height);
  const renderer = await createHeadlessRenderer();
  try {
    await renderer.init(width, height, params);
    const out = await renderer.renderFrame(rgba, width, height, params);
    await encodeRgbaToFile(out, width, height, output);
  } finally {
    await renderer.close();
  }
}
