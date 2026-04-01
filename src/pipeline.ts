import type { ProbeResult } from "./types";
import { createHeadlessRenderer } from "./gpu/wgpu-renderer";

export async function runGpuExport(
  input: string,
  output: string,
  params: Record<string, unknown>,
  probeResult: ProbeResult,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const { width, height, fps, duration } = probeResult;
  if (!width || !height || !fps || !duration) {
    throw new Error("Video metadata incomplete — need width, height, fps, duration");
  }

  const totalFrames = Math.ceil(fps * duration);
  const frameSize = width * height * 4;

  // Spawn FFmpeg decoder: raw RGBA output to stdout
  const decoder = Bun.spawn([
    "ffmpeg", "-i", input,
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-v", "quiet",
    "pipe:1",
  ], { stdout: "pipe", stderr: "pipe" });

  // Spawn FFmpeg encoder: PNG frames from stdin, copy audio from original
  const encoder = Bun.spawn([
    "ffmpeg", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${width}x${height}`, "-r", `${fps}`,
    "-i", "pipe:0",
    "-i", input,
    "-map", "0:v", "-map", "1:a?",
    "-c:a", "copy",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p",
    output,
  ], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });

  // Create headless renderer
  const renderer = await createHeadlessRenderer();
  await renderer.init(width, height, params);

  // Process frames
  const reader = decoder.stdout.getReader();
  const chunks: Uint8Array[] = [];
  let bufferedBytes = 0;
  let frameCount = 0;

  function drainBuffer(needed: number): Uint8Array {
    const result = new Uint8Array(needed);
    let offset = 0;
    while (offset < needed) {
      const chunk = chunks[0];
      const take = Math.min(chunk.length, needed - offset);
      result.set(chunk.subarray(0, take), offset);
      offset += take;
      if (take === chunk.length) {
        chunks.shift();
      } else {
        chunks[0] = chunk.subarray(take);
      }
    }
    bufferedBytes -= needed;
    return result;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      bufferedBytes += value.length;

      while (bufferedBytes >= frameSize) {
        const frame = drainBuffer(frameSize);

        const rendered = await renderer.renderFrame(frame, width, height, params);
        encoder.stdin.write(rendered);

        frameCount++;
        onProgress(Math.min(frameCount / totalFrames, 1));
      }
    }

    encoder.stdin.end();
    const exitCode = await encoder.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(encoder.stderr).text();
      throw new Error(`FFmpeg encoder failed: ${stderr.trim()}`);
    }
    onProgress(1);
  } finally {
    await renderer.close();
  }
}

