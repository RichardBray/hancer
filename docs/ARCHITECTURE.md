# Hancer Architecture

Hancer is a single-binary CLI that applies cinematic film effects to video and images. Rendering is GPU-accelerated via a Rust/wgpu sidecar; FFmpeg handles only decode and encode.

## Monorepo layout

Bun workspaces under `packages/`:

- **`core`** — pure TypeScript: types, effect schema, presets, export presets, `ffprobe` parsing. No I/O of effects, no FFmpeg invocation. Consumed by every other package.
- **`cli`** — entry point (`cli.ts`), argument parsing, subcommand dispatch (`render` / `ui` / `preview` / `preset`), and the `decode → wgpu sidecar → encode` pipeline orchestration.
- **`ui`** — local web UI (server + browser app) for interactive previewing. Launched via `hance ui`.
- **`wgpu`** — Rust crate compiled to a release binary (`hance-wgpu`) shipped alongside the CLI. Reads raw RGBA frames from stdin, applies all effect passes on the GPU, writes raw RGBA to stdout.

## Render pipeline

For video, `runGpuExport` (`packages/cli/src/pipeline.ts`) builds a single shell pipeline:

```
ffmpeg -i <input> -f rawvideo -pix_fmt rgba pipe:1
  | hance-wgpu '<init-json>'
  | ffmpeg -f rawvideo -pix_fmt rgba ... -i pipe:0 -i <input> -map 0:v -map 1:a? -c:a copy -c:v <encoder> <output>
```

- Stage 1 (decoder FFmpeg): demux + decode to raw RGBA frames.
- Stage 2 (wgpu sidecar): runs the effect chain on the GPU (one render pass per effect, ping-ponged between two textures). Init JSON carries `{ width, height, params }`.
- Stage 3 (encoder FFmpeg): re-encodes RGBA to the chosen codec; copies the original audio track from `<input>`. A `scale=in_range=full:out_range=tv` filter converts full-range RGB to limited-range BT.709 YUV so players don't display a washed-out image.

Progress is reported via FFmpeg's `-progress` file, polled every 100 ms and parsed by `parseProgress`.

For still images, `packages/cli/src/gpu/image-pipeline.ts` skips FFmpeg entirely and drives the wgpu sidecar directly.

## Effect chain

Effects are configured by a `PresetData` blob (the union of `FilmOptions` in `packages/core/src/types.ts`):

```
colorSettings → halation → aberration → bloom → grain → vignette → splitTone → cameraShake
```

Order is fixed in the wgpu sidecar; presets only adjust per-effect parameters and the global `blend` factor. The schema lives in `packages/core/src/schema.ts` and is the single source of truth for parameter ranges, defaults, and UI metadata.

## Encoder selection

`pipeline.ts::detectEncoders` parses `ffmpeg -encoders` once and caches the result. On macOS the pipeline prefers VideoToolbox (`h264_videotoolbox` / `hevc_videotoolbox`) for h264/h265 and falls back to `libx264` / `libx265`. ProRes always uses `prores_ks`. CRF values are mapped to VideoToolbox `q:v` via `crfToVideoToolboxQ`.

Export presets (`low` / `medium` / `high` / `max`) live in `packages/core/src/export-presets.ts` and resolve to `{ codec, crf, encodePreset, pixelFormat }`. CLI overrides (`--codec`, `--crf`, `--encode-preset`) win over preset values.

## Presets

- **Built-in presets** ship in the binary (resolved via `builtinPresetsDir`).
- **User presets** live under `userPresetsDir()` (XDG-style) and are listed/loaded by `listPresetNames` / `loadPreset`.
- `applyPreset(name, overrides)` merges built-in + user preset + per-flag CLI overrides into a final `FilmOptions`.

## Build

`bun run build` is a three-step compile:

1. `cargo build --release` — produces `packages/wgpu/target/release/hance-wgpu`.
2. `bun run scripts/build-ui.ts` — bundles the UI into `packages/ui/dist/`.
3. `bun build packages/cli/src/cli.ts --compile` — produces a single `hance` executable. The wgpu sidecar binary is embedded/located via `sidecarPath()`.

`HANCE_VERSION` is injected at compile time via `--define`. Cross-target builds use `BUN_TARGET`.

## Subcommands

- `hance <input>` — default render path described above.
- `hance ui [<file>]` — launches the local web UI server (`@hance/ui/server`).
- `hance preview <input>` — fast in-terminal preview of effects (no encode).
- `hance preset <subcommand>` — list / inspect / manage presets.

## Testing

- Unit tests under `packages/*/__tests__/` cover argument parsing, schema, preset merging, and progress parsing.
- E2E tests under `packages/cli/__tests__/e2e/` exercise the full FFmpeg → sidecar → FFmpeg pipeline against small generated fixtures.
- UI tests use `agent-browser --auto-connect` for WebGPU-capable headless runs.

All tests run via `bun test`.
