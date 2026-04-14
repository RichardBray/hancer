# Hance

**Cinematic film look in one command.** Drop hance into any video pipeline — batch processing, CI/CD, content automation — and get GPU-accelerated colour grading, halation, chromatic aberration, and gate weave without opening an editor. One binary, one pass, no plugins, no subscriptions.

### Why hance?

- **One-pass processing** — all effects compose into a single filter graph. No intermediate files, no re-encoding chains.
- **GPU-accelerated** — native wgpu sidecar renders effects on the GPU. Fast enough for batch workflows.
- **Pipeline-first** — a single binary with CLI flags. Script it, cron it, plug it into your ingest pipeline.
- **No vendor lock-in** — runs on your machine, processes your files locally. Your footage never leaves your disk.

### Effects

- **Grade** — Lift blacks, crush whites, shadow/highlight tinting, fade
- **Halation** — Highlight glow with warm tint (simulates light scattering in film)
- **Chromatic Aberration** — Red/blue channel offset for lens fringing
- **Gate Weave** — Sine-based frame drift simulating projector instability

## Install

```sh
curl -fsSL https://github.com/Orva-Studio/hancer/releases/latest/download/install.sh | sh
```

This installs `hance` and its GPU sidecar to `~/.hance/bin`. The installer detects macOS (arm64/x64) or Linux (x64/arm64). You'll also need `ffmpeg` on your PATH (`brew install ffmpeg` / `apt install ffmpeg`).

Pin a specific version:

```sh
curl -fsSL https://github.com/Orva-Studio/hancer/releases/latest/download/install.sh | sh -s -- --version v0.1.0
```

## Requirements

- **macOS** (primary supported platform — Linux/Windows untested)
- [Bun](https://bun.sh) (for building and running)
- [FFmpeg](https://ffmpeg.org) (runtime dependency for encoding/decoding)
- [Rust](https://rustup.rs) (for building the GPU sidecar)

## Build from source

```bash
# Clone and build
git clone https://github.com/RichardBray/hance.git
cd hance
bun install
bun run build    # builds Rust sidecar + UI + CLI binary

# Optional: add to PATH
ln -s $(pwd)/hance /usr/local/bin/hance
```

### Building components individually

```bash
bun run build:gpu   # Build Rust wgpu sidecar (sidecar/target/release/hance-gpu)
bun run build:ui    # Build browser UI bundle
```

## Usage

```bash
hance <input> [options]
```

### Examples

```bash
# Process video with defaults
hance video.mp4

# Process image
hance photo.png

# Custom output path
hance video.mp4 -o output.mp4

# Adjust effects
hance video.mp4 --lift 0.1 --fade 0.3 --aberration 0.5

# Fast encode, lower quality
hance video.mp4 --preset fast --crf 28
```

### Options

| Flag | Range | Default | Description |
|------|-------|---------|-------------|
| `--output, -o` | | `<input>_hanced.<ext>` | Output path |
| `--codec` | h264/prores/h265 | h264 | Output video codec |
| `--encode-preset` | fast/medium/slow | medium | FFmpeg encoding speed preset |
| `--crf` | 0–51 | 18 | Quality (lower = better, ignored for prores) |
| `--lift` | 0–0.15 | 0.05 | Black lift amount |
| `--crush` | 0–0.15 | 0.04 | White crush amount |
| `--fade` | 0–1 | 0.15 | Contrast fade |
| `--shadow-tint` | warm/cool/neutral | warm | Shadow colour tint |
| `--highlight-tint` | warm/cool/neutral | cool | Highlight colour tint |
| `--halation-intensity` | 0–1 | 0.6 | Glow intensity |
| `--halation-radius` | 1–999 | 51 | Glow blur radius (px) |
| `--halation-threshold` | 0–255 | 180 | Highlight threshold |
| `--halation-warmth` | 0–1 | 0.7 | Glow warmth |
| `--aberration` | 0–1 | 0.3 | Chromatic aberration strength |
| `--weave` | 0–1 | 0.3 | Gate weave strength |

## Architecture

Effects are rendered on the GPU via a native Rust [wgpu](https://wgpu.rs) sidecar binary. WGSL shaders in `src/shaders/` are shared between the browser preview (via Bun text imports) and the Rust sidecar (via `include_str!`). The sidecar communicates with the Bun CLI over stdin/stdout using a length-prefixed JSON init message followed by raw RGBA frames.

## Development

```bash
# Run in dev mode (requires sidecar built first)
bun run build:gpu
bun run src/cli.ts <input> [options]

# Run Bun tests
bun test

# Run e2e tests only
bun test src/__tests__/e2e/

# Run Rust tests
cd sidecar && cargo test

# Build everything
bun run build
```

## Output Quality

By default, hance encodes output as H.264 with CRF 18. If your source is a high-quality format like ProRes (common with `.mov` files from cameras or editing software), the default H.264 output will be lower quality than the original due to lossy compression and 4:2:0 chroma subsampling.

To preserve quality closer to the original:

```bash
# Use ProRes output (near-lossless, 4:2:2 10-bit, larger files)
hance video.mov -o output.mov --codec prores

# Use a lower CRF for higher-quality H.264 (0 = lossless)
hance video.mov -o output.mp4 --crf 8

# Use H.265 for better quality at similar file sizes
hance video.mov -o output.mp4 --codec h265 --crf 12
```

| Codec | Quality | File Size | Compatibility |
|-------|---------|-----------|---------------|
| `h264` (default) | Good (CRF-dependent) | Smallest | Universal |
| `h265` | Better at same CRF | ~30% smaller than h264 | Most modern players |
| `prores` | Near-lossless (4:2:2 10-bit) | Largest | macOS, editing software |

## License

[FSL-1.1-Apache-2.0](LICENSE) — free to use, modify, and redistribute. Cannot be used to build a competing product or service. Converts to Apache 2.0 on April 1, 2028.
