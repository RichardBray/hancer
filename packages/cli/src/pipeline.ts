import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import type { ProbeResult, OutputCodec } from "@hance/core";
import { parseProgress } from "./progress";

interface EncoderSettings {
  codec: OutputCodec;
  crf: number;
  encodePreset: string;
}

function sidecarPath(): string {
  return join(import.meta.dir, "..", "..", "wgpu", "target", "release", "hance-gpu");
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

  // Convert full-range RGB (from the GPU sidecar) to limited-range BT.709 YUV
  // so players don't display a washed-out, muted image.
  const bt709Filter = "scale=in_range=full:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p";
  const bt709Tags = [
    "-color_range", "tv",
    "-colorspace", "bt709",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
  ];

  switch (settings.codec) {
    case "prores":
      base.push(
        "-vf", "scale=in_range=full:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv422p10le",
        "-c:v", "prores_ks", "-profile:v", "3",
        ...bt709Tags,
      );
      break;
    case "h265":
      base.push("-vf", bt709Filter);
      if (encoders.has("hevc_videotoolbox")) {
        base.push("-c:v", "hevc_videotoolbox", "-q:v", String(vtQ), "-tag:v", "hvc1");
      } else {
        base.push("-c:v", "libx265", "-preset", settings.encodePreset, "-crf", String(settings.crf), "-tag:v", "hvc1");
      }
      base.push(...bt709Tags);
      break;
    case "h264":
    default:
      base.push("-vf", bt709Filter);
      if (encoders.has("h264_videotoolbox")) {
        base.push("-c:v", "h264_videotoolbox", "-q:v", String(vtQ));
      } else {
        base.push("-c:v", "libx264", "-preset", settings.encodePreset, "-crf", String(settings.crf));
      }
      base.push(...bt709Tags);
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

  const progressPath = join(tmpdir(), `hance-progress-${process.pid}-${Date.now()}.log`);
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
