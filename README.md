# Hance

> ⚠️ **Alpha software.** Hance is early-stage and has mainly been tested on macOS by a single developer. Expect rough edges on Linux/Windows, and pin versions if you use it in anything important.

**A cinematic film-look engine for video and stills.** Dial in a look in the browser UI, then apply it headlessly across a whole folder from the CLI — GPU-accelerated colour, halation, bloom, grain, vignette, split-tone, aberration, and camera shake in a single pass. One binary, no plugins, no subscriptions.

### Why hance?

- **One-pass processing** — all effects compose into a single GPU render graph. No intermediate files, no re-encoding chains.
- **GPU-accelerated** — native wgpu sidecar renders effects on the GPU. Fast enough for batch workflows.
- **Pipeline-first** — a single binary with CLI flags, presets, and batch input. Script it, cron it, plug it into your ingest pipeline.
- **Optional browser UI** — `hance ui` launches a local preview app when you want to dial in a look interactively.
- **No vendor lock-in** — runs on your machine, processes your files locally. Your footage never leaves your disk.

### Effects

- **Color** — exposure, contrast, highlight compression, fade, white balance, tint, subtractive saturation, richness, bleach bypass
- **Halation** — highlight glow with hue/saturation controls (simulates light scattering in film)
- **Bloom** — soft highlight bloom independent of halation
- **Grain** — film grain with size, softness, saturation, and defocus
- **Vignette** — soft corner falloff
- **Split Tone** — shadow/highlight tinting with a neutral-protect mode
- **Chromatic Aberration** — red/blue channel offset for lens fringing
- **Camera Shake** — procedural handheld motion

---

## Install the CLI (recommended)

No Bun, Rust, or Node required — just FFmpeg.

```sh
curl -fsSL https://github.com/Orva-Studio/hancer/releases/latest/download/install.sh | sh
```

This installs `hance` and its GPU sidecar to `~/.hance/bin`. The installer detects macOS (arm64/x64) or Linux (x64/arm64).

You'll also need `ffmpeg` on your PATH:

```sh
brew install ffmpeg   # macOS
apt install ffmpeg    # Debian/Ubuntu
```

Pin a specific version:

```sh
curl -fsSL https://github.com/Orva-Studio/hancer/releases/latest/download/install.sh | sh -s -- --version v0.1.2
```

---

## Usage

```bash
hance <input> [<input> ...] [options]
```

### Examples

```bash
# Process a video with defaults
hance video.mp4

# Process an image
hance photo.png

# Custom output path
hance video.mp4 -o output.mp4

# Batch process — outputs go next to each input (or into -o if it's a directory)
hance clip1.mp4 clip2.mp4 clip3.mov -o ./graded/

# Load a built-in preset
hance video.mp4 --preset heavy

# Override preset values
hance video.mp4 --preset subtle --grain-amount 0.2 --aberration 0.5

# ProRes output for editing workflows
hance video.mov --codec prores -o output.mov

# Launch the local browser UI for interactive preview
hance ui
```

### Presets

Hance ships with a handful of built-in presets (see `presets/*.hlook`). Pass `--preset <name>` to start from one; any additional flags override its values.

`.hlook` files are JSON. The `hance_version` field records the version of Hance that wrote the file; it's informational, used for debugging and forward compatibility. Unknown effect parameters are ignored on load, so presets authored on newer versions still load on older binaries (the unknown effects simply don't apply).

### Common options

| Flag | Range / values | Default | Description |
|------|----------------|---------|-------------|
| `--output, -o` | path | `<input>_hanced.<ext>` | Output file (single input) or directory (multi-input) |
| `--preset` | name | `default` | Load a preset before applying flags |
| `--codec` | h264 / h265 / prores | h264 | Output video codec |
| `--encode-preset` | fast / medium / slow | medium | FFmpeg encoding speed |
| `--crf` | 0–51 | 18 | Quality — lower is better (ignored for prores) |
| `--export` | low / medium / high / max | — | Export quality preset |
| `--blend` | 0–1 | 1 | Blend final result with original |

Run `hance --help` for the full list of effect flags (color, halation, bloom, grain, vignette, split-tone, camera-shake, aberration, etc.). Every effect group also has a `--no-<effect>` switch to disable it.

### Interactive UI

```bash
hance ui                      # opens http://localhost:4800 in your browser
hance ui path/to/video.mp4    # open the UI with a file preloaded
hance ui --port 5000          # custom port
hance ui --no-open            # don't auto-open browser
```

---

## Output quality

By default, hance encodes output as H.264 with CRF 18. If your source is a high-quality format like ProRes (common with `.mov` files from cameras or editing software), the default H.264 output will be lower quality than the original due to lossy compression and 4:2:0 chroma subsampling.

```bash
# ProRes output (near-lossless, 4:2:2 10-bit, larger files)
hance video.mov -o output.mov --codec prores

# Lower CRF for higher-quality H.264 (0 = lossless)
hance video.mov -o output.mp4 --crf 8

# H.265 for better quality at similar file sizes
hance video.mov -o output.mp4 --codec h265 --crf 12
```

| Codec | Quality | File Size | Compatibility |
|-------|---------|-----------|---------------|
| `h264` (default) | Good (CRF-dependent) | Smallest | Universal |
| `h265` | Better at same CRF | ~30% smaller than h264 | Most modern players |
| `prores` | Near-lossless (4:2:2 10-bit) | Largest | macOS, editing software |

---

## Build from source

Only needed if you want to hack on hance itself. The released CLI binary does **not** require any of this.

### Requirements

- [Bun](https://bun.sh) — runtime and build tool
- [Rust](https://rustup.rs) — for the wgpu GPU sidecar
- [FFmpeg](https://ffmpeg.org) — runtime dependency

### Build

```bash
git clone https://github.com/RichardBray/hance.git
cd hance
bun install
bun run build    # builds wgpu sidecar + UI bundle + CLI binary → ./hance

# Optional: add to PATH
ln -s "$(pwd)/hance" /usr/local/bin/hance
```

### Individual build steps

```bash
bun run build:wgpu   # Rust wgpu sidecar (packages/wgpu/target/release/hance-gpu)
bun run build:ui     # Browser UI bundle
```

### Dev loop

```bash
# Run the CLI directly from source (needs sidecar built first)
bun run build:wgpu
bun run packages/cli/src/cli.ts <input> [options]

# Unit tests
bun test

# E2E tests (actual FFmpeg + GPU execution)
bun test packages/cli/__tests__/e2e/

# Rust tests
cd packages/wgpu && cargo test
```

---

## Architecture

Hance is a Bun workspaces monorepo:

- `packages/core` — pure TypeScript effect/preset/arg logic
- `packages/cli` — the compiled `hance` binary entry point
- `packages/ui` — the browser-based interactive preview
- `packages/wgpu` — the Rust wgpu sidecar binary

Effects are rendered on the GPU via the native Rust [wgpu](https://wgpu.rs) sidecar. WGSL shaders are shared between the browser preview and the Rust sidecar. The sidecar communicates with the Bun CLI over stdin/stdout using a length-prefixed JSON init message followed by raw RGBA frames.

See [ARCHITECTURE.md](ARCHITECTURE.md) for more detail.

---

## License

[FSL-1.1-Apache-2.0](LICENSE) — free to use, modify, and redistribute. Cannot be used to build a competing product or service. Converts to Apache 2.0 on April 1, 2028.
