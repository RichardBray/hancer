# wgpu Sidecar Design

**Goal:** Replace the Playwright headless Chrome renderer with a native Rust sidecar using `wgpu` for GPU-accelerated video/image export. Headless Chrome does not reliably support WebGPU, making it unsuitable for video processing.

**Architecture:** A standalone Rust binary (`hance-gpu`) communicates with Bun over stdin/stdout pipes. It receives raw RGBA frames, runs the same WGSL shader chain, and writes rendered RGBA frames back. The browser preview path is unchanged.

---

## 1. Sidecar Binary

A Rust binary in `sidecar/` that:

1. Reads a length-prefixed JSON init message from stdin: `{width, height, params}`
2. Initializes `wgpu` (adapter with `HighPerformance`, device, textures, pipelines)
3. Enters a frame loop: reads `width × height × 4` raw RGBA bytes from stdin, renders through the effect chain, writes `width × height × 4` rendered RGBA bytes to stdout
4. Auto-increments an internal frame counter (for grain temporal noise, camera shake)
5. Exits when stdin closes

### Protocol

```
→ stdin:  [4-byte little-endian JSON length][JSON: {width, height, params}]
→ stdin:  [RGBA frame bytes, width*height*4] (repeated per frame)
← stdout: [RGBA frame bytes, width*height*4] (repeated per frame)
```

### Project Layout

```
sidecar/
  Cargo.toml          # wgpu, serde, serde_json, pollster
  src/
    main.rs           # stdin/stdout loop, JSON parsing, frame I/O
    renderer.rs       # wgpu device/pipeline setup, effect chain execution
    passes.rs         # runPass() helper, bind group creation
    params.rs         # Param struct deserialization, uniform buffer packing
```

### Dependencies

- `wgpu` — WebGPU implementation
- `serde` + `serde_json` — JSON param parsing
- `pollster` — block on async wgpu calls

### GPU Readback

Uses a staging buffer with `MAP_READ` usage and `copy_texture_to_buffer`. Handles 256-byte row alignment padding, same pattern as the existing `readPixels()` in `renderer.ts`.

### Error Handling

If wgpu adapter/device request fails (no GPU), exit with code 1 and a message on stderr. The Bun side reads stderr and surfaces the error to the user.

---

## 2. Shared WGSL Shaders

Extract all shaders from `src/ui/app/gpu/shaders.ts` into individual `.wgsl` files in `src/shaders/`:

| File | Shader |
|------|--------|
| `fullscreen.vert.wgsl` | Fullscreen triangle vertex shader |
| `color-settings.frag.wgsl` | Color correction (contrast, brightness, saturation, gamma, white balance, tint, bleach bypass) |
| `threshold.frag.wgsl` | Highlight thresholding for halation |
| `blur.frag.wgsl` | Separable Gaussian blur |
| `screen-blend.frag.wgsl` | Screen blend with hue shift (halation/bloom compositing) |
| `aberration.frag.wgsl` | Chromatic aberration |
| `grain.frag.wgsl` | Film grain with temporal noise |
| `vignette.frag.wgsl` | Cosine vignette |
| `split-tone.frag.wgsl` | Shadow/midtone/highlight tinting |
| `camera-shake.frag.wgsl` | Sinusoidal camera displacement |

**Browser side:** `src/ui/app/gpu/shaders.ts` becomes re-exports importing the `.wgsl` files:

```typescript
import FULLSCREEN_VERT from "../../../shaders/fullscreen.vert.wgsl";
// etc.
export { FULLSCREEN_VERT, ... };
```

The `Bun.build` call in `scripts/build-ui.ts` needs a loader entry to treat `.wgsl` as text:

```typescript
loader: { ".wgsl": "text" },
```

**Rust side:** Embedded at compile time via `include_str!("../../src/shaders/color-settings.frag.wgsl")`.

Both consumers use identical shader source — parity guaranteed by construction.

---

## 3. Render Pipeline (Rust)

The sidecar replicates the effect chain from `renderer.ts`:

```
Source RGBA → [Color Settings] → texA
  → [Halation]   (optional: threshold → halfA, H-blur → halfB, V-blur → halfA, screen blend)
  → [Aberration]  (optional)
  → [Bloom]       (optional: downsample → halfA, H-blur → halfB, V-blur → halfA, screen blend)
  → [Grain]       (optional, uses frame counter for temporal animation)
  → [Vignette]    (optional)
  → [Split Tone]  (optional)
  → [Camera Shake] (optional, uses frame counter)
  → Readback → stdout
```

### Texture Setup

Same as renderer.ts:
- `srcTex` — input RGBA, written via `queue.write_texture`
- `texA`, `texB` — full-resolution ping-pong targets
- `halfA`, `halfB` — half-resolution for halation/bloom blur

### Bind Group Layouts

- **Standard (3 bindings):** texture, sampler, uniform buffer — used by most effects
- **Blend (4 bindings):** base texture, sampler, overlay texture, uniform buffer — used by screen blend

### Uniform Buffers

All 16-byte aligned, matching the existing WGSL struct layouts:

| Buffer | Size | Used By |
|--------|------|---------|
| colorUB | 32 bytes | Color settings |
| thresholdUB | 16 bytes | Halation threshold |
| blurUB (×4) | 16 bytes each | Halation H/V blur, Bloom H/V blur |
| blendUB (×2) | 16 bytes each | Halation blend, Bloom blend |
| aberrationUB | 16 bytes | Chromatic aberration |
| grainUB | 32 bytes | Film grain |
| vignetteUB | 16 bytes | Vignette |
| splitToneUB | 32 bytes | Split tone |
| shakeUB | 16 bytes | Camera shake |

### Parameter Scaling

Same as renderer.ts:
- `halation-radius` × 0.5 → blur sigma
- `aberration` × 0.02 → offset
- `vignette-amount` × π/2 → angle
- `camera-shake-amount` × 3 / width → amplitude
- `camera-shake-rate` → 30 / (rate + 0.01) for period
- `getSplitToneTintValues()` logic ported to Rust

---

## 4. Bun Integration

### New: `src/gpu/wgpu-renderer.ts`

Replaces `headless-renderer.ts`. Same `HeadlessRenderer` interface:

```typescript
export interface HeadlessRenderer {
  init(width: number, height: number): Promise<void>;
  renderFrame(rgba: Uint8Array, width: number, height: number, params: Record<string, unknown>): Promise<Uint8Array>;
  close(): Promise<void>;
}
```

Implementation:
- `createHeadlessRenderer()` spawns `sidecar/target/release/hance-gpu` via `Bun.spawn`
- `init()` writes the length-prefixed JSON init message to stdin
- `renderFrame()` writes raw RGBA bytes to stdin, reads `width*height*4` bytes from stdout
- `close()` closes stdin, waits for process exit

### Deleted Files

- `src/gpu/headless-renderer.ts` — replaced by `wgpu-renderer.ts`
- `src/gpu/render-worker-entry.ts` — no longer needed
- Playwright dependency removed from `package.json`

### Unchanged Files

- `src/pipeline.ts` — calls `createHeadlessRenderer()`, same interface
- `src/cli.ts` — same interface
- `src/ui/server.ts` — same interface
- `src/ui/app/gpu/renderer.ts` — browser rendering logic unchanged, just different shader imports
- `src/ui/app/gpu/passes.ts` — unchanged
- All presets, UI components, types — unchanged

---

## 5. Build

**Rust sidecar:**
```bash
cd sidecar && cargo build --release
```

**Binary location:** `sidecar/target/release/hance-gpu`

The Bun side resolves the sidecar path relative to `import.meta.dir` during dev. For distribution, the sidecar binary is placed alongside the compiled Bun binary.

Add to `package.json` scripts:
```json
"build:gpu": "cd sidecar && cargo build --release",
"build": "bun run build:gpu && bun build src/cli.ts --compile --outfile hance"
```

---

## 6. Testing

### Rust Unit Tests (`cargo test`)

- Param JSON parsing → correct uniform buffer bytes
- Protocol message framing (length-prefixed JSON read/write)
- `getSplitToneTintValues` port correctness
- No GPU required for these

### Rust Integration Test (`cargo test`, requires GPU)

- 2×2 RGBA frame with identity params → output matches input
- Skip if no GPU adapter available

### Bun Integration Test (`bun test`)

- `src/__tests__/gpu/headless-renderer.test.ts` — updated to use wgpu sidecar
- Same shape: init, render small frame, verify Uint8Array of correct size
- Determinism: same input + params → identical output twice

### E2E Test (`bun test`)

- Existing `src/__tests__/e2e/gpu-export.test.ts` passes unchanged (same HeadlessRenderer interface)
