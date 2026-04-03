import type { ProbeResult, OutputCodec } from "@hancer/core";
import { createHeadlessRenderer } from "./gpu/wgpu-renderer";

interface EncoderSettings {
  codec: OutputCodec;
  crf: number;
  encodePreset: string;
}

function buildEncoderArgs(settings: EncoderSettings, width: number, height: number, fps: number, input: string, output: string): string[] {
  const base = [
    "ffmpeg", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${width}x${height}`, "-r", `${fps}`,
    "-i", "pipe:0",
    "-i", input,
    "-map", "0:v", "-map", "1:a?",
    "-c:a", "copy",
  ];

  switch (settings.codec) {
    case "prores":
      base.push("-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le");
      break;
    case "h265":
      base.push("-c:v", "libx265", "-preset", settings.encodePreset, "-crf", String(settings.crf), "-pix_fmt", "yuv420p", "-tag:v", "hvc1");
      break;
    case "h264":
    default:
      base.push("-c:v", "libx264", "-preset", settings.encodePreset, "-crf", String(settings.crf), "-pix_fmt", "yuv420p");
      break;
  }

  base.push(output);
  return base;
}

export async function runGpuExport(
  input: string,
  output: string,
  params: Record<string, unknown>,
  probeResult: ProbeResult,
  onProgress: (ratio: number) => void,
  encoderSettings?: EncoderSettings,
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

  // Spawn FFmpeg encoder
  const settings = encoderSettings ?? { codec: "h264", crf: 18, encodePreset: "medium" };
  const encoderArgs = buildEncoderArgs(settings, width, height, fps, input, output);
  const encoder = Bun.spawn(encoderArgs, { stdin: "pipe", stdout: "pipe", stderr: "pipe" });

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

