# Openhancer

Single-binary CLI that applies cinematic film effects to video and images in one FFmpeg pass.

## Effects

- **Grade** — Lift blacks, crush whites, shadow/highlight tinting, fade
- **Halation** — Highlight glow with warm tint (simulates light scattering in film)
- **Chromatic Aberration** — Red/blue channel offset for lens fringing
- **Gate Weave** — Sine-based frame drift simulating projector instability

All effects compose into a single FFmpeg `-filter_complex` graph for efficient processing.

## Requirements

- [Bun](https://bun.sh) (for building)
- [FFmpeg](https://ffmpeg.org) (runtime dependency)

## Install

```bash
# Clone and build
git clone https://github.com/RichardBray/openhancer.git
cd openhancer
bun install
bun run build

# Optional: add to PATH
ln -s $(pwd)/openhancer /usr/local/bin/openhancer
```

## Usage

```bash
openhancer <input> [options]
```

### Examples

```bash
# Process video with defaults
openhancer video.mp4

# Process image
openhancer photo.png

# Custom output path
openhancer video.mp4 -o output.mp4

# Adjust effects
openhancer video.mp4 --lift 0.1 --fade 0.3 --aberration 0.5

# Fast encode, lower quality
openhancer video.mp4 --preset fast --crf 28
```

### Options

| Flag | Range | Default | Description |
|------|-------|---------|-------------|
| `--output, -o` | | `<input>_openhanced.<ext>` | Output path |
| `--preset` | fast/medium/slow | medium | FFmpeg encoding preset |
| `--crf` | 0–51 | 18 | Quality (lower = better) |
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

## Development

```bash
# Run in dev mode
bun run src/cli.ts <input> [options]

# Run tests
bun test

# Run e2e tests only
bun test src/__tests__/e2e/

# Build binary
bun run build
```

## License

[MIT](LICENSE)
