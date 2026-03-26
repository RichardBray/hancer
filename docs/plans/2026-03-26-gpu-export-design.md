# GPU Export Pipeline Design

## Problem

The web preview (WebGPU shaders) and FFmpeg export (filter graph) are separate implementations with different math. This causes visual drift — most notably a persistent pink/magenta cast in halation — that cannot be fully resolved because the underlying algorithms differ.

## Solution

Replace the FFmpeg filter graph with GPU rendering using the same WebGPU shaders as the preview. FFmpeg remains for video decode/encode/audio mux only.

## Architecture

### Image Export

Pure client-side. No server involvement.

```
canvas.toBlob() → URL.createObjectURL() → browser download
```

The user sees the preview, clicks export, and downloads exactly what they see.

### Video Export

Three processes orchestrated by the Bun server:

```
FFmpeg decoder → Headless Chrome (GPU render) → FFmpeg encoder
    (raw RGBA frames)    (same shaders)         (H.264 + audio mux)
```

1. **FFmpeg decoder** — decodes input video to raw RGBA frames piped to stdout
2. **Headless Chrome** — receives raw frames, renders through WebGPU shaders, outputs rendered pixels
3. **FFmpeg encoder** — receives rendered RGBA from stdin, encodes video, muxes audio from original

### Headless Chrome Renderer

A new module `src/gpu/headless-renderer.ts` manages a persistent headless Chromium instance via Playwright.

**Lifecycle:**
- Chromium launches once when the server starts (not per-export)
- A dedicated page loads a minimal HTML file that imports the existing `renderer.ts` and `shaders.ts`
- The page exposes functions: `loadFrame(rgba, width, height)`, `render(params)`, `readPixels()`
- On server shutdown, Chromium closes

**Per-frame flow:**
1. Server reads one raw RGBA frame from FFmpeg decoder stdout (width × height × 4 bytes)
2. Sends buffer to Chrome page via `page.evaluate()`
3. Page uploads to GPU via `device.queue.writeTexture()`
4. Runs all shader passes via `renderFrame()`
5. Reads canvas back via WebGL readback or `canvas.toBlob()`
6. Returns rendered pixel buffer to server
7. Server writes buffer to FFmpeg encoder stdin

**Renderer changes:**
- `renderer.ts` gets a new `setSourceFromBuffer(rgba, width, height)` method that uses `device.queue.writeTexture()` instead of `copyExternalImageToTexture()`
- All other rendering logic (pass chain, shaders, textures) stays unchanged
- Browser preview continues using `setSource(img/video)` as before

### FFmpeg Role

FFmpeg changes from filter engine to pure codec wrapper.

**Decode command:**
```
ffmpeg -i input.mp4 -f rawvideo -pix_fmt rgba -v quiet pipe:1
```

**Encode command:**
```
ffmpeg -f rawvideo -pix_fmt rgba -s WxH -r FPS -i pipe:0 \
       -i input.mp4 -map 0:v -map 1:a -c:a copy \
       -c:v libx264 -preset medium -crf 18 output.mp4
```

**Probe** (`probe.ts`) still needed for width, height, fps, duration, frame count.

### Server & API Changes

The `/api/export` endpoint changes internally but keeps the same API contract:

- Request: `POST /api/export` with file + params (unchanged)
- Response: SSE progress events, then download URL (unchanged)
- Client/UI does not change

**Image export** is removed from the server entirely — handled client-side.

**Video export** implementation:
1. Probe input for dimensions, fps, frame count
2. Spawn FFmpeg decoder subprocess
3. Send params to headless Chrome renderer
4. Loop: read frame from decoder → render in Chrome → write to encoder
5. Stream progress as SSE (current frame / total frames)
6. On completion, return download URL

### What Gets Deleted

- `src/effects/halation.ts`
- `src/effects/bloom.ts`
- `src/effects/aberration.ts`
- `src/effects/splitTone.ts`
- `src/effects/splitToneMath.ts`
- `src/effects/grain.ts`
- `src/effects/vignette.ts`
- `src/effects/cameraShake.ts`
- `src/effects/colorSettings.ts`
- `src/effects/utils.ts`
- `buildFilterGraph()` in `pipeline.ts`
- All FFmpeg filter graph logic in `runPipelineWithProgress()`
- Related unit tests for FFmpeg filter output

### What Stays

- `probe.ts` — media metadata
- FFmpeg spawn utilities (repurposed for raw decode/encode)
- Progress reporting (repurposed: frame count based instead of time based)
- `renderer.ts` and `shaders.ts` — the source of truth for rendering
- All UI components, preset system, web server

## Performance

Estimated video export speed (headless Chrome, 1080p):

| Step | Per-frame |
|------|-----------|
| FFmpeg decode | ~1-2ms |
| Buffer transfer to Chrome | ~2-3ms |
| GPU render (all passes) | ~2-5ms |
| Pixel readback from GPU | ~3-8ms |
| Buffer transfer to FFmpeg | ~1-2ms |
| FFmpeg encode | ~5-10ms |
| **Total** | **~15-30ms (~30-65fps)** |

Roughly 2-4x slower than the current FFmpeg-only path. Acceptable for now — future Rust wgpu sidecar eliminates browser overhead.

## Future: Rust wgpu Sidecar

The architecture is designed so headless Chrome can be swapped for a Rust binary:

- Same WGSL shaders (copy unchanged)
- Same interface (stdin frames → GPU render → stdout frames)
- Same FFmpeg decode/encode wrapper
- Only `headless-renderer.ts` changes — replaced by Rust process spawning

This is a separate future effort, not part of this plan.

## Testing Strategy

- **Image parity test:** Render in browser, export via client-side download, compare pixels — should be identical
- **Video frame parity test:** Export single-frame video, compare to image export of same frame — should match
- **Preset regression tests:** Export with each built-in preset, compare to web preview screenshots
- **E2E video test:** Full video export, verify output plays correctly with audio intact
