import type { FilmOptions, FilterResult, ProbeResult } from "./types";
import { colorSettingsFilter } from "./effects/colorSettings";
import { halationFilter } from "./effects/halation";
import { aberrationFilter } from "./effects/aberration";
import { bloomFilter } from "./effects/bloom";
import { grainFilter } from "./effects/grain";
import { vignetteFilter } from "./effects/vignette";
import { splitToneFilter } from "./effects/splitTone";
import { cameraShakeFilter } from "./effects/cameraShake";
import { parseProgress, renderProgressBar } from "./progress";

function applyEffect(
  fragments: string[],
  currentLabel: string,
  fn: (input: string, opts: never) => FilterResult,
  opts: unknown,
): string {
  const result = fn(currentLabel, opts as never);
  fragments.push(result.fragment);
  return result.output;
}

export function buildFilterGraph(
  options: FilmOptions,
  isImage: boolean
): { graph: string; finalLabel: string } {
  const fragments: string[] = [];
  let label = "0:v";

  const needsBlend = options.blend < 1;
  if (needsBlend) {
    fragments.push(`[0:v]split=2[gb_orig][gb_proc]`);
    label = "gb_proc";
  }

  label = applyEffect(fragments, label, colorSettingsFilter, options.colorSettings);
  label = applyEffect(fragments, label, halationFilter, options.halation);
  label = applyEffect(fragments, label, aberrationFilter, options.aberration);
  label = applyEffect(fragments, label, bloomFilter, options.bloom);
  label = applyEffect(fragments, label, grainFilter, options.grain);
  label = applyEffect(fragments, label, vignetteFilter, options.vignette);
  label = applyEffect(fragments, label, splitToneFilter, options.splitTone);

  if (!isImage) {
    label = applyEffect(fragments, label, cameraShakeFilter, options.cameraShake);
  }

  if (needsBlend) {
    const opacity = options.blend.toFixed(4);
    fragments.push(`[gb_orig][${label}]blend=all_mode=normal:all_opacity=${opacity}[blend_out]`);
    label = "blend_out";
  }

  return { graph: fragments.join(";"), finalLabel: label };
}

export async function runPipeline(
  options: FilmOptions,
  probeResult: ProbeResult
): Promise<void> {
  const { graph, finalLabel } = buildFilterGraph(options, probeResult.isImage);

  const args = [
    "ffmpeg", "-y",
    "-i", options.input,
    "-filter_complex", graph,
    "-map", `[${finalLabel}]`,
  ];

  if (!probeResult.isImage) {
    args.push("-map", "0:a?", "-c:a", "copy");
  }

  if (probeResult.isImage) {
    args.push(options.output);
  } else {
    args.push(
      "-c:v", "libx264",
      "-preset", options.encodePreset,
      "-crf", String(options.crf),
      "-progress", "pipe:1",
      "-nostats",
      options.output
    );
  }

  if (probeResult.isImage) {
    process.stdout.write("Processing...\n");
  }

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (!probeResult.isImage && probeResult.duration) {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const ratio = parseProgress(buffer, probeResult.duration);
      if (ratio !== null) {
        process.stdout.write("\r" + renderProgressBar(ratio));
        buffer = "";
      }
    }
    process.stdout.write("\n");
  }

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error(`FFmpeg failed (exit ${exitCode}):\n${stderr.trim()}`);
    process.exit(1);
  }

  if (probeResult.isImage) {
    console.log("Done.");
  }
}
