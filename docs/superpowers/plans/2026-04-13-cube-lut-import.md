# .cube LUT Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import `.cube` 3D LUT files and apply them as the final step in the color grading pipeline via trilinear-filtered 3D texture sampling in WebGPU.

**Architecture:** A new `.cube` parser in `packages/core` produces a flat `Float32Array` of RGB triplets + a size integer. The WebGPU renderer (both browser UI and Rust sidecar) uploads this as a `texture_3d<f32>` and samples it with trilinear filtering in a new LUT shader pass inserted at the end of the color chain (after color settings, before halation). The UI adds a file picker and intensity slider to the Adjustments panel. The CLI adds a `--lut` flag.

**Tech Stack:** TypeScript (Bun), WGSL shaders, WebGPU API, Rust/wgpu (sidecar)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/core/src/lut-parser.ts` | Parse `.cube` file text → `{ size: number, data: Float32Array }` |
| Create | `packages/core/__tests__/lut-parser.test.ts` | Unit tests for parser |
| Create | `packages/core/shaders/lut.frag.wgsl` | LUT application shader (3D texture sample + intensity mix) |
| Modify | `packages/core/src/index.ts` | Re-export `parseCubeLut` |
| Modify | `packages/core/src/types.ts` | Add `LutOptions` interface |
| Modify | `packages/core/src/schema.ts` | Add LUT effect group to `EFFECT_SCHEMA` |
| Modify | `packages/ui/app/gpu/shaders.ts` | Import and export LUT shader |
| Modify | `packages/ui/app/gpu/renderer.ts` | Add LUT bind group layout, 3D texture, pipeline, and render pass |
| Modify | `packages/ui/app/components/AdjustmentsPanel.tsx` | Add LUT file picker section above effect groups |
| Modify | `packages/ui/app/App.tsx` | Wire LUT file upload state to renderer |
| Modify | `packages/cli/src/cli.ts` | Add `--lut` flag and `--lut-intensity` flag |
| Modify | `packages/wgpu/src/passes.rs` | Add `create_lut_bind_group_layout`, `make_lut_bind_group` |
| Modify | `packages/wgpu/src/renderer.rs` | Add LUT 3D texture, pipeline, render pass |
| Modify | `packages/wgpu/src/params.rs` | Add LUT param accessors |
| Create | `packages/core/__tests__/fixtures/identity-2.cube` | Tiny 2×2×2 identity LUT for tests |

---

### Task 1: .cube Parser

**Files:**
- Create: `packages/core/src/lut-parser.ts`
- Create: `packages/core/__tests__/lut-parser.test.ts`
- Create: `packages/core/__tests__/fixtures/identity-2.cube`

- [ ] **Step 1: Create the test fixture**

Create `packages/core/__tests__/fixtures/identity-2.cube`:

```
TITLE "Identity 2x2x2"
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
```

- [ ] **Step 2: Write the failing tests**

Create `packages/core/__tests__/lut-parser.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCubeLut } from "../src/lut-parser";

const FIXTURE_DIR = join(import.meta.dir, "fixtures");

describe("parseCubeLut", () => {
  it("parses a valid 2x2x2 identity LUT", () => {
    const text = readFileSync(join(FIXTURE_DIR, "identity-2.cube"), "utf-8");
    const lut = parseCubeLut(text);
    expect(lut.size).toBe(2);
    expect(lut.data.length).toBe(2 * 2 * 2 * 4); // RGBA
    // First entry: R=0 G=0 B=0 A=1
    expect(lut.data[0]).toBeCloseTo(0);
    expect(lut.data[1]).toBeCloseTo(0);
    expect(lut.data[2]).toBeCloseTo(0);
    expect(lut.data[3]).toBeCloseTo(1);
    // Second entry: R=1 G=0 B=0 A=1
    expect(lut.data[4]).toBeCloseTo(1);
    expect(lut.data[5]).toBeCloseTo(0);
    expect(lut.data[6]).toBeCloseTo(0);
    expect(lut.data[7]).toBeCloseTo(1);
  });

  it("ignores comment lines and TITLE", () => {
    const text = `# A comment\nTITLE "Test"\nLUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1`;
    const lut = parseCubeLut(text);
    expect(lut.size).toBe(2);
    expect(lut.data.length).toBe(2 * 2 * 2 * 4);
  });

  it("clamps values outside DOMAIN_MIN/DOMAIN_MAX to 0-1", () => {
    const text = `LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n-0.1 0 0\n1.5 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1`;
    const lut = parseCubeLut(text);
    expect(lut.data[0]).toBe(0); // clamped from -0.1
    expect(lut.data[4]).toBe(1); // clamped from 1.5
  });

  it("throws on missing LUT_3D_SIZE", () => {
    expect(() => parseCubeLut("0 0 0\n1 1 1")).toThrow(/LUT_3D_SIZE/);
  });

  it("throws on wrong number of entries", () => {
    const text = `LUT_3D_SIZE 2\n0 0 0\n1 1 1`;
    expect(() => parseCubeLut(text)).toThrow(/expected 8/i);
  });

  it("rejects 1D LUTs", () => {
    const text = `LUT_1D_SIZE 16\n0 0 0`;
    expect(() => parseCubeLut(text)).toThrow(/3D/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test packages/core/__tests__/lut-parser.test.ts`
Expected: FAIL — `parseCubeLut` not found

- [ ] **Step 4: Implement the parser**

Create `packages/core/src/lut-parser.ts`:

```typescript
export interface CubeLut {
  size: number;
  data: Float32Array;
}

export function parseCubeLut(text: string): CubeLut {
  const lines = text.split("\n");
  let size = 0;
  const entries: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith("TITLE")) continue;

    if (line.startsWith("LUT_1D_SIZE")) {
      throw new Error("Only 3D LUTs are supported (found LUT_1D_SIZE)");
    }

    if (line.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }

    if (line.startsWith("DOMAIN_MIN") || line.startsWith("DOMAIN_MAX")) continue;

    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const r = Math.max(0, Math.min(1, parseFloat(parts[0])));
      const g = Math.max(0, Math.min(1, parseFloat(parts[1])));
      const b = Math.max(0, Math.min(1, parseFloat(parts[2])));
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        entries.push(r, g, b, 1.0);
      }
    }
  }

  if (size === 0) {
    throw new Error("Missing LUT_3D_SIZE declaration in .cube file");
  }

  const expected = size * size * size;
  if (entries.length / 4 !== expected) {
    throw new Error(`Invalid .cube file: expected ${expected} entries, got ${entries.length / 4}`);
  }

  return { size, data: new Float32Array(entries) };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/core/__tests__/lut-parser.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Export from core**

Add to `packages/core/src/index.ts`:

```typescript
export { parseCubeLut, type CubeLut } from "./lut-parser";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lut-parser.ts packages/core/__tests__/lut-parser.test.ts packages/core/__tests__/fixtures/identity-2.cube packages/core/src/index.ts
git commit -m "feat(core): add .cube LUT file parser with tests"
```

---

### Task 2: LUT Types and Schema

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/schema.ts`
- Modify: `packages/core/__tests__/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/__tests__/schema.test.ts`:

```typescript
it("includes lut effect group with intensity slider", () => {
  const lutGroup = EFFECT_SCHEMA.find(g => g.key === "lut");
  expect(lutGroup).toBeDefined();
  expect(lutGroup!.enableKey).toBe("no-lut");
  const intensityOpt = lutGroup!.options.find(o => o.key === "lut-intensity");
  expect(intensityOpt).toBeDefined();
  expect(intensityOpt!.type).toBe("range");
  expect((intensityOpt as any).default).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/__tests__/schema.test.ts`
Expected: FAIL — no "lut" group in EFFECT_SCHEMA

- [ ] **Step 3: Add LutOptions type**

Add to `packages/core/src/types.ts` after `CameraShakeOptions`:

```typescript
export interface LutOptions {
  enabled: boolean;
  path: string;
  intensity: number;
}
```

Add `lut: LutOptions;` to the `FilmOptions` interface.

- [ ] **Step 4: Add LUT group to schema**

Add to `EFFECT_SCHEMA` array in `packages/core/src/schema.ts` (at the beginning, before "colorSettings"):

```typescript
{
  key: "lut",
  label: "LUT",
  enableKey: "no-lut",
  options: [
    { key: "lut-intensity", label: "Intensity", type: "range", min: 0, max: 1, step: 0.01, default: 1 },
  ],
},
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/core/__tests__/schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/schema.ts packages/core/__tests__/schema.test.ts
git commit -m "feat(core): add LUT types and schema definition"
```

---

### Task 3: LUT WGSL Shader

**Files:**
- Create: `packages/core/shaders/lut.frag.wgsl`

The LUT shader needs a different bind group layout than the standard one — it requires a 3D texture and a separate sampler for trilinear filtering, plus the 2D source texture and a uniform for intensity.

- [ ] **Step 1: Create the LUT shader**

Create `packages/core/shaders/lut.frag.wgsl`:

```wgsl
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var lutTex: texture_3d<f32>;
@group(0) @binding(3) var lutSamp: sampler;

struct LutParams {
  intensity: f32,
  lutSize: f32,
  _pad0: f32,
  _pad1: f32,
};
@group(0) @binding(4) var<uniform> params: LutParams;

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = textureSample(src, samp, uv).rgb;

  // Scale UV coordinates to sample the center of each LUT cell
  // to avoid edge interpolation artifacts
  let scale = (params.lutSize - 1.0) / params.lutSize;
  let offset = 0.5 / params.lutSize;
  let lutCoord = color * scale + offset;

  let lutColor = textureSample(lutTex, lutSamp, lutCoord).rgb;
  let result = mix(color, lutColor, params.intensity);
  return vec4f(result, 1.0);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/shaders/lut.frag.wgsl
git commit -m "feat(core): add LUT application WGSL shader"
```

---

### Task 4: WebGPU UI Renderer — LUT Pass

**Files:**
- Modify: `packages/ui/app/gpu/shaders.ts`
- Modify: `packages/ui/app/gpu/renderer.ts`

- [ ] **Step 1: Add shader import**

Add to `packages/ui/app/gpu/shaders.ts`:

```typescript
import LUT_FRAG from "../../../core/shaders/lut.frag.wgsl";
```

Add `LUT_FRAG` to the export list.

- [ ] **Step 2: Add LUT bind group layout and resources to renderer**

In `packages/ui/app/gpu/renderer.ts`, add the following inside `createRenderer` after `const blendLayout = createBlendLayout(device);`:

Create a new layout function at module level (after `createBlendLayout`):

```typescript
function createLutLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "3d" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],
  });
}
```

Inside `createRenderer`, after the blend layout and existing resources:

```typescript
const lutLayout = createLutLayout(device);
const lutPipeline = createFullscreenPipeline(device, FULLSCREEN_VERT, LUT_FRAG, lutLayout, format);
const lutUB = createUniformBuffer(device, 16); // intensity + lutSize + 2 padding

// Default: 1×1×1 identity LUT (passthrough)
let lutTex = device.createTexture({
  size: { width: 1, height: 1, depthOrArrayLayers: 1 },
  dimension: "3d",
  format: "rgba8unorm",
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});
device.queue.writeTexture(
  { texture: lutTex },
  new Uint8Array([128, 128, 128, 255]),
  { bytesPerRow: 4, rowsPerImage: 1 },
  { width: 1, height: 1, depthOrArrayLayers: 1 },
);
let lutSize = 1;
const lutSampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
```

- [ ] **Step 3: Add `setLut` method to the renderer**

Add inside `createRenderer`, before the `return` block:

```typescript
function setLut(data: Float32Array, size: number): void {
  lutTex.destroy();
  // Convert Float32 RGBA to Uint8 RGBA for rgba8unorm texture
  const rgba8 = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    rgba8[i] = Math.round(Math.max(0, Math.min(1, data[i])) * 255);
  }
  lutTex = device.createTexture({
    size: { width: size, height: size, depthOrArrayLayers: size },
    dimension: "3d",
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: lutTex },
    rgba8,
    { bytesPerRow: size * 4, rowsPerImage: size },
    { width: size, height: size, depthOrArrayLayers: size },
  );
  lutSize = size;
}

function clearLut(): void {
  lutTex.destroy();
  lutTex = device.createTexture({
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    dimension: "3d",
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: lutTex },
    new Uint8Array([128, 128, 128, 255]),
    { bytesPerRow: 4, rowsPerImage: 1 },
    { width: 1, height: 1, depthOrArrayLayers: 1 },
  );
  lutSize = 1;
}
```

- [ ] **Step 4: Add LUT render pass to the render chain**

In the `renderFrame` function, insert the LUT pass **after the color settings pass** (after the `if (params["no-color-settings"] !== true)` block) and **before halation**:

```typescript
// --- LUT ---
if (params["no-lut"] !== true && lutSize > 1) {
  const intensity = num("lut-intensity", 1);
  if (intensity > 0) {
    device.queue.writeBuffer(lutUB, 0, new Float32Array([intensity, lutSize, 0, 0]));
    const lutBG = device.createBindGroup({
      layout: lutLayout,
      entries: [
        { binding: 0, resource: current.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: lutTex.createView() },
        { binding: 3, resource: lutSampler },
        { binding: 4, resource: { buffer: lutUB } },
      ],
    });
    runPass(encoder, lutPipeline, lutBG, other.createView());
    swap();
  }
}
```

- [ ] **Step 5: Update the Renderer interface and return object**

Add to the `Renderer` interface:

```typescript
setLut(data: Float32Array, size: number): void;
clearLut(): void;
```

Add `setLut` and `clearLut` to the returned object. Add `lutTex.destroy()` to the `destroy()` method.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/app/gpu/shaders.ts packages/ui/app/gpu/renderer.ts packages/core/shaders/lut.frag.wgsl
git commit -m "feat(ui): integrate LUT 3D texture into WebGPU render pipeline"
```

---

### Task 5: UI — LUT File Picker

**Files:**
- Modify: `packages/ui/app/components/AdjustmentsPanel.tsx`
- Modify: `packages/ui/app/App.tsx`

- [ ] **Step 1: Add LUT section to AdjustmentsPanel**

In `packages/ui/app/components/AdjustmentsPanel.tsx`, add a new prop and a file picker section above the effect groups. Update the interface:

```typescript
interface Props {
  schema: EffectGroupType[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  activeLookParams: Record<string, string | number | boolean> | null;
  onSave: () => void;
  onSaveAsNew: () => void;
  animating: boolean;
  lutFileName: string | null;
  onLutUpload: (file: File) => void;
  onLutClear: () => void;
}
```

Add the LUT section in the JSX, between `<SaveBar>` and the effect groups `<div>`:

```tsx
<div className="px-3 py-2 border-b border-zinc-800">
  <div className="flex items-center justify-between mb-1.5">
    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">LUT</span>
    {lutFileName && (
      <button
        onClick={onLutClear}
        className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Remove
      </button>
    )}
  </div>
  {lutFileName ? (
    <div className="text-xs text-zinc-400 truncate">{lutFileName}</div>
  ) : (
    <label className="flex items-center justify-center h-8 border border-dashed border-zinc-700 rounded text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer">
      <input
        type="file"
        accept=".cube"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onLutUpload(file);
        }}
      />
      Load .cube file
    </label>
  )}
</div>
```

- [ ] **Step 2: Wire LUT state in App.tsx**

In `packages/ui/app/App.tsx`, add state and handlers. Find where the renderer is used and add:

```typescript
const [lutFileName, setLutFileName] = useState<string | null>(null);

function handleLutUpload(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result as string;
    try {
      const lut = parseCubeLut(text);
      renderer.setLut(lut.data, lut.size);
      setLutFileName(file.name);
    } catch (err) {
      console.error("Failed to parse LUT:", err);
    }
  };
  reader.readAsText(file);
}

function handleLutClear() {
  renderer.clearLut();
  setLutFileName(null);
}
```

Import `parseCubeLut` from `@hancer/core` at the top of App.tsx.

Pass `lutFileName`, `handleLutUpload`, and `handleLutClear` as props to `AdjustmentsPanel`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/app/components/AdjustmentsPanel.tsx packages/ui/app/App.tsx
git commit -m "feat(ui): add LUT file picker to adjustments panel"
```

---

### Task 6: CLI — `--lut` Flag

**Files:**
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/__tests__/cli.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/cli/__tests__/cli.test.ts`:

```typescript
it("parses --lut and --lut-intensity flags", () => {
  const parsed = parseArgs(["input.mp4", "--lut", "my-look.cube", "--lut-intensity", "0.8"]);
  expect(parsed.params["lut"]).toBe("my-look.cube");
  expect(parsed.params["lut-intensity"]).toBe(0.8);
});

it("defaults lut-intensity to 1 when --lut is provided", () => {
  const parsed = parseArgs(["input.mp4", "--lut", "my-look.cube"]);
  expect(parsed.params["lut"]).toBe("my-look.cube");
  expect(parsed.params["lut-intensity"]).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/cli/__tests__/cli.test.ts`
Expected: FAIL — unknown flag `--lut`

- [ ] **Step 3: Add --lut and --lut-intensity to CLI**

In `packages/cli/src/cli.ts`:

Add to `HELP_TEXT` (after the Preset section):

```
  LUT:
  --lut          <path>       Apply a .cube LUT file
  --lut-intensity <0-1>       LUT blend intensity (default: 1)
  --no-lut                    Disable LUT
```

Add `"--lut"`, `"--lut-intensity"`, `"--no-lut"` to `KNOWN_FLAGS`.

Add `"--no-lut"` to `BOOLEAN_FLAGS`.

In the switch statement for valued flags, add:

```typescript
case "--lut": overrides["lut"] = val; break;
case "--lut-intensity": overrides["lut-intensity"] = parseNum(val, "--lut-intensity", 0, 1); break;
```

In the `BOOLEAN_FLAGS` switch, add:

```typescript
case "--no-lut": overrides["no-lut"] = true; break;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/cli/__tests__/cli.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/cli.ts packages/cli/__tests__/cli.test.ts
git commit -m "feat(cli): add --lut and --lut-intensity flags"
```

---

### Task 7: Rust Sidecar — LUT Support

**Files:**
- Modify: `packages/wgpu/src/passes.rs`
- Modify: `packages/wgpu/src/renderer.rs`
- Modify: `packages/wgpu/src/params.rs`

This task adds LUT support to the Rust/wgpu headless renderer so that CLI exports apply the LUT.

- [ ] **Step 1: Add LUT param accessors**

In `packages/wgpu/src/params.rs`, add methods to extract LUT path and intensity:

```rust
pub fn lut_path(&self) -> Option<String> {
    self.str("lut")
}

pub fn lut_intensity(&self) -> f32 {
    self.float("lut-intensity", 1.0)
}

pub fn lut_enabled(&self) -> bool {
    !self.bool("no-lut", false) && self.lut_path().is_some()
}
```

- [ ] **Step 2: Add LUT bind group layout to passes.rs**

Add to `packages/wgpu/src/passes.rs`:

```rust
pub fn create_lut_bind_group_layout(device: &Device) -> BindGroupLayout {
    device.create_bind_group_layout(&BindGroupLayoutDescriptor {
        label: Some("lut_layout"),
        entries: &[
            BindGroupLayoutEntry {
                binding: 0,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Texture {
                    sample_type: TextureSampleType::Float { filterable: true },
                    view_dimension: TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 1,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Sampler(SamplerBindingType::Filtering),
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 2,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Texture {
                    sample_type: TextureSampleType::Float { filterable: true },
                    view_dimension: TextureViewDimension::D3,
                    multisampled: false,
                },
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 3,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Sampler(SamplerBindingType::Filtering),
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 4,
                visibility: ShaderStages::FRAGMENT,
                ty: BindingType::Buffer {
                    ty: BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            },
        ],
    })
}

pub fn make_lut_bind_group(
    device: &Device,
    layout: &BindGroupLayout,
    src_texture: &TextureView,
    src_sampler: &Sampler,
    lut_texture: &TextureView,
    lut_sampler: &Sampler,
    uniform: &Buffer,
) -> BindGroup {
    device.create_bind_group(&BindGroupDescriptor {
        label: None,
        layout,
        entries: &[
            BindGroupEntry { binding: 0, resource: BindingResource::TextureView(src_texture) },
            BindGroupEntry { binding: 1, resource: BindingResource::Sampler(src_sampler) },
            BindGroupEntry { binding: 2, resource: BindingResource::TextureView(lut_texture) },
            BindGroupEntry { binding: 3, resource: BindingResource::Sampler(lut_sampler) },
            BindGroupEntry { binding: 4, resource: uniform.as_entire_binding() },
        ],
    })
}
```

- [ ] **Step 3: Add LUT loading and render pass to renderer.rs**

In `packages/wgpu/src/renderer.rs`:

Add the LUT shader constant:

```rust
const LUT_FRAG: &str = include_str!("../../core/shaders/lut.frag.wgsl");
```

Add fields to `GpuRenderer`:

```rust
lut_layout: BindGroupLayout,
lut_pipeline: RenderPipeline,
lut_tex: Texture,
lut_sampler: Sampler,
lut_ub: Buffer,
lut_size: u32,
```

In `GpuRenderer::new`, after the existing pipeline creation:

```rust
let lut_layout = passes::create_lut_bind_group_layout(&device);
let lut_pipeline = passes::create_pipeline(&device, VERT, LUT_FRAG, &lut_layout, FORMAT);
let lut_ub = passes::create_uniform_buffer(&device, 16);
let lut_sampler = device.create_sampler(&SamplerDescriptor {
    mag_filter: FilterMode::Linear,
    min_filter: FilterMode::Linear,
    ..Default::default()
});

// Parse and load LUT if provided
let (lut_tex, lut_size) = if let Some(lut_path) = Params::new(raw_params.clone()).lut_path() {
    let text = std::fs::read_to_string(&lut_path)
        .map_err(|e| format!("Failed to read LUT file '{}': {}", lut_path, e))?;
    let (size, data) = parse_cube_lut(&text)?;
    let tex = device.create_texture(&TextureDescriptor {
        label: Some("lut_3d"),
        size: Extent3d { width: size, height: size, depth_or_array_layers: size },
        mip_level_count: 1,
        sample_count: 1,
        dimension: TextureDimension::D3,
        format: TextureFormat::Rgba8Unorm,
        usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
        view_formats: &[],
    });
    queue.write_texture(
        TexelCopyTextureInfo { texture: &tex, mip_level: 0, origin: Origin3d::ZERO, aspect: TextureAspect::All },
        &data,
        TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(size * 4), rows_per_image: Some(size) },
        Extent3d { width: size, height: size, depth_or_array_layers: size },
    );
    (tex, size)
} else {
    // 1×1×1 identity fallback
    let tex = device.create_texture(&TextureDescriptor {
        label: Some("lut_3d_identity"),
        size: Extent3d { width: 1, height: 1, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: TextureDimension::D3,
        format: TextureFormat::Rgba8Unorm,
        usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
        view_formats: &[],
    });
    queue.write_texture(
        TexelCopyTextureInfo { texture: &tex, mip_level: 0, origin: Origin3d::ZERO, aspect: TextureAspect::All },
        &[128, 128, 128, 255],
        TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(4), rows_per_image: Some(1) },
        Extent3d { width: 1, height: 1, depth_or_array_layers: 1 },
    );
    (tex, 1)
};
```

Add a minimal `.cube` parser function in `renderer.rs`:

```rust
fn parse_cube_lut(text: &str) -> Result<(u32, Vec<u8>), String> {
    let mut size: u32 = 0;
    let mut entries: Vec<u8> = Vec::new();

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("TITLE")
            || line.starts_with("DOMAIN_MIN") || line.starts_with("DOMAIN_MAX") {
            continue;
        }
        if line.starts_with("LUT_1D_SIZE") {
            return Err("Only 3D LUTs are supported".into());
        }
        if line.starts_with("LUT_3D_SIZE") {
            size = line.split_whitespace().nth(1)
                .ok_or("Missing LUT_3D_SIZE value")?
                .parse().map_err(|e| format!("Invalid LUT_3D_SIZE: {e}"))?;
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            if let (Ok(r), Ok(g), Ok(b)) = (parts[0].parse::<f32>(), parts[1].parse::<f32>(), parts[2].parse::<f32>()) {
                entries.push((r.clamp(0.0, 1.0) * 255.0).round() as u8);
                entries.push((g.clamp(0.0, 1.0) * 255.0).round() as u8);
                entries.push((b.clamp(0.0, 1.0) * 255.0).round() as u8);
                entries.push(255);
            }
        }
    }

    if size == 0 { return Err("Missing LUT_3D_SIZE".into()); }
    let expected = (size * size * size) as usize;
    if entries.len() / 4 != expected {
        return Err(format!("Expected {} LUT entries, got {}", expected, entries.len() / 4));
    }
    Ok((size, entries))
}
```

In `render_frame`, insert the LUT pass **after color settings** and **before halation**:

```rust
// --- LUT ---
if self.params.lut_enabled() && self.lut_size > 1 {
    let intensity = self.params.lut_intensity();
    self.write_uniform(&self.lut_ub, &[intensity, self.lut_size as f32, 0.0, 0.0]);
    let bg = passes::make_lut_bind_group(
        &self.device, &self.lut_layout,
        &current_tex!().create_view(&TextureViewDescriptor::default()),
        &self.sampler,
        &self.lut_tex.create_view(&TextureViewDescriptor::default()),
        &self.lut_sampler,
        &self.lut_ub,
    );
    passes::run_pass(&mut encoder, &self.lut_pipeline, &bg,
        &other_tex!().create_view(&TextureViewDescriptor::default()));
    swap!();
}
```

- [ ] **Step 4: Build the Rust sidecar to verify compilation**

Run: `cd packages/wgpu && cargo build --release 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/wgpu/src/passes.rs packages/wgpu/src/renderer.rs packages/wgpu/src/params.rs
git commit -m "feat(wgpu): add LUT 3D texture support to Rust sidecar renderer"
```

---

### Task 8: Presets — LUT Support in Preset System

**Files:**
- Modify: `packages/core/src/presets.ts`
- Modify: `packages/core/__tests__/presets.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/__tests__/presets.test.ts`:

```typescript
it("includes lut options from overrides", () => {
  const opts = applyPreset("default", { "lut": "cinematic.cube", "lut-intensity": 0.7 });
  expect(opts.lut.enabled).toBe(true);
  expect(opts.lut.path).toBe("cinematic.cube");
  expect(opts.lut.intensity).toBe(0.7);
});

it("disables lut by default (no path)", () => {
  const opts = applyPreset("default", {});
  expect(opts.lut.enabled).toBe(false);
  expect(opts.lut.path).toBe("");
});

it("respects no-lut override", () => {
  const opts = applyPreset("default", { "lut": "test.cube", "no-lut": true });
  expect(opts.lut.enabled).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/__tests__/presets.test.ts`
Expected: FAIL — `opts.lut` is undefined

- [ ] **Step 3: Add LUT to applyPreset**

In `packages/core/src/presets.ts`, add after the `cameraShake` block and before `const encodePreset`:

```typescript
const lut: LutOptions = {
  enabled: merged["no-lut"] ? false : Boolean(merged["lut"]),
  path: String(merged["lut"] ?? ""),
  intensity: Number(merged["lut-intensity"] ?? 1),
};
```

Import `LutOptions` from `./types`.

Add `lut` to the `EffectOptions` interface and to the return value of `applyPreset`.

Add `"lut"` and `"lut-intensity"` to `mergedParams` passthrough.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/core/__tests__/presets.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/presets.ts packages/core/__tests__/presets.test.ts
git commit -m "feat(core): add LUT options to preset system"
```

---

### Task 9: Integration Test — Manual Verification

- [ ] **Step 1: Start the UI dev server**

Run: `bun run packages/cli/src/cli.ts ui`

- [ ] **Step 2: Verify LUT file picker appears**

Open the browser, load a media file. Confirm:
- "LUT" section appears at the top of the Adjustments panel
- "Load .cube file" button is visible

- [ ] **Step 3: Test with a real .cube file**

Load a `.cube` LUT file (download any free one, e.g., a Rec.709 to teal-orange LUT). Confirm:
- The preview updates immediately with the LUT applied
- The intensity slider (under the LUT effect group) adjusts the blend
- "Remove" button clears the LUT and returns to the original look

- [ ] **Step 4: Run all tests one final time**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address integration issues from LUT testing"
```
