import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import type { ProbeResult, OutputCodec } from "@hancer/core";
import { parseProgress } from "./progress";

interface EncoderSettings {
  codec: OutputCodec;
  crf: number;
  encodePreset: string;
}

function sidecarPath(): string {
  return join(import.meta.dir, "..", "..", "wgpu", "target", "release", "hancer-gpu");
}

let cachedEncoders: Set<string> | null = null;
async function detectEncoders(): Promise<Set<string>> {
  if (cachedEncoders) return cachedEncoders;
  const proc = Bun.spawn(["ffmpeg", "-hide_banner", "-encoders"], { stdout: "pipe", stderr: "ignore" });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  const set = new Set<string>();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[A-Z.]+\s+(\S+)/);
    if (m) set.add(m[1]);
  }
  cachedEncoders = set;
  return set;
}

// Map libx264-style CRF (0-51, lower=better) to VideoToolbox q:v (1-100, higher=better)
function crfToVideoToolboxQ(crf: number): number {
  const q = Math.round(100 - crf * 2);
  return Math.max(1, Math.min(100, q));
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function buildEncoderArgs(settings: EncoderSettings, width: number, height: number, fps: number, input: string, output: string, progressPath: string, encoders: Set<string>): string[] {
  const base = [
    "ffmpeg", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${width}x${height}`, "-r", `${fps}`,
    "-i", "pipe:0",
    "-i", input,
    "-map", "0:v", "-map", "1:a?",
    "-c:a", "copy",
  ];

  const vtQ = crfToVideoToolboxQ(settings.crf);

  switch (settings.codec) {
    case "prores":
      base.push("-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le");
      break;
    case "h265":
      if (encoders.has("hevc_videotoolbox")) {
        base.push("-c:v", "hevc_videotoolbox", "-q:v", String(vtQ), "-pix_fmt", "yuv420p", "-tag:v", "hvc1");
      } else {
        base.push("-c:v", "libx265", "-preset", settings.encodePreset, "-crf", String(settings.crf), "-pix_fmt", "yuv420p", "-tag:v", "hvc1");
      }
      break;
    case "h264":
    default:
      if (encoders.has("h264_videotoolbox")) {
        base.push("-c:v", "h264_videotoolbox", "-q:v", String(vtQ), "-pix_fmt", "yuv420p");
      } else {
        base.push("-c:v", "libx264", "-preset", settings.encodePreset, "-crf", String(settings.crf), "-pix_fmt", "yuv420p");
      }
      break;
  }

  base.push("-progress", progressPath, "-v", "error", output);
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

  const progressPath = join(tmpdir(), `hancer-progress-${process.pid}-${Date.now()}.log`);
  const initJson = JSON.stringify({ width, height, params });

  const decoderCmd = [
    "ffmpeg", "-i", shellEscape(input),
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-v", "quiet",
    "pipe:1",
  ].join(" ");

  const sidecarCmd = `${shellEscape(sidecarPath())} ${shellEscape(initJson)}`;

  const settings = encoderSettings ?? { codec: "h264", crf: 18, encodePreset: "medium" };
  const encoders = await detectEncoders();
  const encoderArgs = buildEncoderArgs(settings, width, height, fps, input, output, progressPath, encoders);
  const encoderCmd = encoderArgs.map((a, i) => i === 0 ? a : shellEscape(a)).join(" ");

  const pipeline = `set -o pipefail; ${decoderCmd} | ${sidecarCmd} | ${encoderCmd}`;

  const proc = Bun.spawn(["sh", "-c", pipeline], {
    stdout: "inherit",
    stderr: "inherit",
  });

  // Poll progress file while the pipeline runs
  let stopPolling = false;
  const pollProgress = (async () => {
    while (!stopPolling) {
      try {
        const text = await Bun.file(progressPath).text();
        const lines = text.split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
          const ratio = parseProgress(lines[i], duration);
          if (ratio !== null) {
            onProgress(Math.min(ratio, 1));
            break;
          }
        }
      } catch {
        // file not yet created
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  })();

  try {
    const exitCode = await proc.exited;
    stopPolling = true;
    await pollProgress;
    if (exitCode !== 0) {
      throw new Error(`Export pipeline failed (exit ${exitCode})`);
    }
    onProgress(1);
  } finally {
    stopPolling = true;
    try { await unlink(progressPath); } catch {}
  }
}
