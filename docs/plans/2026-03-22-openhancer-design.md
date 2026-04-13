# Openhance — Design Document

**Date:** 2026-03-22
**Status:** Approved

## Overview

Openhance is a single-binary CLI tool that applies cinematic film effects to video and images in a single FFmpeg pass. Built with Bun and TypeScript, compiled to a standalone binary.

**Binary names:** `openhance` (primary), `oph` (symlink alias)

**Target users:** The author and other developers. Not aimed at film professionals.

## Architecture

Monolithic filter builder — each effect module is a pure function that returns a filter string fragment and output label. `pipeline.ts` chains them into one `-filter_complex` graph. Video is encoded exactly once. No temp files, no multi-pass.

```
cli.ts (parse args, validate, strict unknown-flag rejection)
  → probe.ts (detect duration, image vs video)
  → pipeline.ts (chain effect modules, build filter_complex, spawn ffmpeg)
      → grade.ts      → FilterResult
      → halation.ts   → FilterResult
      → aberration.ts → FilterResult
      → weave.ts      → FilterResult
  → progress.ts (parse ffmpeg stdout, render progress bar — skipped for images)
```

### Shared interface

```typescript
interface FilterResult {
  fragment: string  // filter_complex fragment
  output: string    // output label e.g. "graded"
}

type EffectFn = (input: string, options: EffectOptions) => FilterResult
```

## Project Structure

```
openhance/
├── src/
│   ├── cli.ts
│   ├── pipeline.ts
│   ├── effects/
│   │   ├── halation.ts
│   │   ├── grade.ts
│   │   ├── aberration.ts
│   │   └── weave.ts
│   ├── probe.ts
│   └── progress.ts
├── package.json
├── tsconfig.json
└── docs/
    └── plans/
```

## Effect Modules

### 1. Grade (grade.ts)

Lifts blacks, crushes whites, applies colour tints, reduces contrast. The foundational "film doesn't have pure black or white" quality.

**FFmpeg approach:** `curves` filter for lift/crush/tints, `eq` for contrast fade. Tint presets map to small per-channel curve offsets.

```typescript
interface GradeOptions {
  liftBlacks: number       // 0.0–0.15, default 0.05
  crushWhites: number      // 0.0–0.15, default 0.04
  shadowTint: 'warm' | 'cool' | 'neutral'   // default 'warm'
  highlightTint: 'warm' | 'cool' | 'neutral' // default 'cool'
  fade: number             // 0.0–1.0, default 0.15
}
```

### 2. Halation (halation.ts)

Bright areas bleed a warm red/orange glow, simulating light scattering behind film emulsion.

**FFmpeg approach:** Split → isolate highlights via `curves` → tint warm (boost red, cut blue) → `gblur` → `blend=screen` back onto original. Radius enforced odd (`radius % 2 === 0 ? radius + 1 : radius`).

```typescript
interface HalationOptions {
  intensity: number   // 0.0–1.0, default 0.6
  radius: number      // pixels, default 51 (must be odd)
  threshold: number   // 0–255, default 180
  warmth: number      // 0.0–1.0, default 0.7
}
```

### 3. Chromatic Aberration (aberration.ts)

Slightly offsets red and blue channels in opposite directions, creating colour fringing on high-contrast edges.

**FFmpeg approach:** Split into R/G/B via `extractplanes` → scale R slightly larger, B slightly smaller → `mergeplanes`. Offset = `strength * 0.02`. Requires RGB pixel format handling.

```typescript
interface AberrationOptions {
  strength: number    // 0.0–1.0, default 0.3
}
```

### 4. Gate Weave (weave.ts)

Subtle per-frame translation mimicking mechanical film gate instability. **Skipped for image input.**

**FFmpeg approach:** `crop` with sine-based expressions using frame number `n`. Prime periods (37, 53) to avoid repetition. Followed by `scale` to restore dimensions.

```typescript
interface WeaveOptions {
  strength: number    // 0.0–1.0, default 0.3
}
```

### Effect chain order

grade → halation → aberration → weave

## Input / Output

### Input detection

`probe.ts` runs `ffprobe` to get duration and codec type. If duration is null/0 or codec is image type (mjpeg, png, etc.), treat as image.

### Supported formats

- **Video:** .mp4, .mov, and any format FFmpeg supports (auto-detected)
- **Images:** .jpg, .png, .tiff, etc.

### Output defaults

- `input_openhanced.<same extension as input>`
- Overridable with `--output / -o`

### Image mode differences

- Gate weave is skipped (no frames to drift)
- No audio mapping (`-map 0:a?` / `-c:a copy` omitted)
- Output as single image
- No progress bar — print "Processing..." then "Done."

## CLI Flags

```
openhance <input> [options]

  Input/Output:
  --output, -o <path>       Output path (default: <input>_openhanced.<ext>)
  --preset     <string>     FFmpeg preset: fast/medium/slow (default: medium)
  --crf        <0-51>       Quality — lower is better (default: 18)

  Colour Grade:
  --lift          <0-0.15>  Black lift amount (default: 0.05)
  --crush         <0-0.15>  White crush amount (default: 0.04)
  --fade          <0-1>     Overall contrast fade (default: 0.15)
  --shadow-tint   <warm|cool|neutral>   (default: warm)
  --highlight-tint <warm|cool|neutral>  (default: cool)

  Halation:
  --halation-intensity  <0-1>    (default: 0.6)
  --halation-radius     <px>     (default: 51)
  --halation-threshold  <0-255>  (default: 180)
  --halation-warmth     <0-1>    (default: 0.7)

  Chromatic Aberration:
  --aberration  <0-1>   (default: 0.3)

  Gate Weave:
  --weave  <0-1>   (default: 0.3)

  General:
  --help, -h     Show this help
```

**Strict flag parsing:** Unknown flags are rejected with an error message and suggestion to use `--help`.

## Error Handling

- **FFmpeg/ffprobe not found:** Check PATH at startup, exit with install instructions (`brew install ffmpeg`)
- **Input file not found:** Clear error message
- **Invalid flag values:** Exit with specific validation error + usage hint for that flag
- **Unknown flags:** Reject with error listing the unrecognized flag
- **FFmpeg process failure:** Capture stderr, print it, exit non-zero

## Progress

Parse `out_time_ms` from FFmpeg's `-progress pipe:1`, divide by `duration * 1_000_000` for 0–1 ratio. Render as `[████░░░░░░] 42.1%`, overwrite in place with `\r`.

## Build & Distribution

```json
{
  "name": "openhance",
  "version": "1.0.0",
  "scripts": {
    "start": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --compile --outfile openhance"
  }
}
```

Install: `bun run build`, copy binary to PATH, create `oph` symlink.

Single external dependency: FFmpeg must be installed on the system.

## Future Considerations (not in v1)

- Preset "looks" (e.g. `--look kodak-portra`) that bundle effect defaults
- User-defined presets via config file
