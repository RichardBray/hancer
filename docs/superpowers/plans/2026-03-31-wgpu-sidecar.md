# wgpu Sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Playwright headless Chrome GPU renderer with a native Rust `wgpu` sidecar binary that communicates over stdin/stdout pipes.

**Architecture:** WGSL shaders are extracted to shared `.wgsl` files consumed by both the browser (via Bun text imports) and Rust (via `include_str!`). The Rust sidecar reads a JSON init message then processes raw RGBA frames through the same effect chain. The Bun side spawns the sidecar instead of Playwright.

**Tech Stack:** Rust (wgpu, serde_json, pollster), Bun, TypeScript, WGSL

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/shaders/fullscreen.vert.wgsl` | Fullscreen triangle vertex shader |
| `src/shaders/color-settings.frag.wgsl` | Color correction fragment shader |
| `src/shaders/threshold.frag.wgsl` | Highlight threshold fragment shader |
| `src/shaders/blur.frag.wgsl` | Separable Gaussian blur fragment shader |
| `src/shaders/screen-blend.frag.wgsl` | Screen blend fragment shader |
| `src/shaders/aberration.frag.wgsl` | Chromatic aberration fragment shader |
| `src/shaders/grain.frag.wgsl` | Film grain fragment shader |
| `src/shaders/vignette.frag.wgsl` | Vignette fragment shader |
| `src/shaders/split-tone.frag.wgsl` | Split tone fragment shader |
| `src/shaders/camera-shake.frag.wgsl` | Camera shake fragment shader |
| `sidecar/Cargo.toml` | Rust project manifest |
| `sidecar/src/main.rs` | stdin/stdout frame loop, JSON init parsing |
| `sidecar/src/renderer.rs` | wgpu device/pipeline setup, effect chain |
| `sidecar/src/passes.rs` | Render pass helper, bind group creation |
| `sidecar/src/params.rs` | Param deserialization, uniform buffer packing, split tone math |
| `src/gpu/wgpu-renderer.ts` | Bun-side sidecar spawner (replaces headless-renderer.ts) |

### Modified Files

| File | Change |
|------|--------|
| `src/ui/app/gpu/shaders.ts` | Re-export from `.wgsl` files instead of inline strings |
| `scripts/build-ui.ts` | Add `.wgsl` text loader; remove render-worker build |
| `src/pipeline.ts` | Import from `wgpu-renderer` instead of `headless-renderer` |
| `src/cli.ts` | Import from `wgpu-renderer` instead of `headless-renderer` |
| `package.json` | Remove `playwright` dep; add `build:gpu` script |
| `src/__tests__/gpu/headless-renderer.test.ts` | Update import to `wgpu-renderer` |
| `src/__tests__/e2e/gpu-export.test.ts` | Update import to `wgpu-renderer` |

### Deleted Files

| File | Reason |
|------|--------|
| `src/gpu/headless-renderer.ts` | Replaced by `wgpu-renderer.ts` |
| `src/gpu/render-worker-entry.ts` | No longer needed (was Playwright bridge) |
| `src/gpu/render-worker.html` | No longer needed |
| `src/gpu/dist/` | Build artifacts for render worker |

---

### Task 1: Extract WGSL shaders to shared files

Extract all shader strings from `src/ui/app/gpu/shaders.ts` into individual `.wgsl` files and update imports.

**Files:**
- Create: `src/shaders/fullscreen.vert.wgsl`
- Create: `src/shaders/color-settings.frag.wgsl`
- Create: `src/shaders/threshold.frag.wgsl`
- Create: `src/shaders/blur.frag.wgsl`
- Create: `src/shaders/screen-blend.frag.wgsl`
- Create: `src/shaders/aberration.frag.wgsl`
- Create: `src/shaders/grain.frag.wgsl`
- Create: `src/shaders/vignette.frag.wgsl`
- Create: `src/shaders/split-tone.frag.wgsl`
- Create: `src/shaders/camera-shake.frag.wgsl`
- Modify: `src/ui/app/gpu/shaders.ts`
- Modify: `scripts/build-ui.ts`

- [ ] **Step 1: Create `src/shaders/fullscreen.vert.wgsl`**

```wgsl
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertexOutput {
  // Fullscreen triangle trick: 3 vertices, no vertex buffer
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var out: VertexOutput;
  out.position = vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(uv.x, 1.0 - uv.y); // flip Y for texture coords
  return out;
}
```

- [ ] **Step 2: Create `src/shaders/color-settings.frag.wgsl`**

Copy the content of `COLOR_SETTINGS_FRAG` from `src/ui/app/gpu/shaders.ts` (lines 21-82) — the WGSL code inside the template literal, without the backticks or `/* wgsl */` annotation.

- [ ] **Step 3: Create remaining 8 shader files**

Same approach for each — extract the WGSL string body from `shaders.ts`:

| Export name | Lines in shaders.ts | Output file |
|---|---|---|
| `THRESHOLD_FRAG` | 87-104 | `src/shaders/threshold.frag.wgsl` |
| `BLUR_FRAG` | 109-134 | `src/shaders/blur.frag.wgsl` |
| `SCREEN_BLEND_FRAG` | 139-197 | `src/shaders/screen-blend.frag.wgsl` |
| `ABERRATION_FRAG` | 202-223 | `src/shaders/aberration.frag.wgsl` |
| `GRAIN_FRAG` | 228-283 | `src/shaders/grain.frag.wgsl` |
| `VIGNETTE_FRAG` | 288-307 | `src/shaders/vignette.frag.wgsl` |
| `SPLIT_TONE_FRAG` | 312-353 | `src/shaders/split-tone.frag.wgsl` |
| `CAMERA_SHAKE_FRAG` | 358-375 | `src/shaders/camera-shake.frag.wgsl` |

- [ ] **Step 4: Rewrite `src/ui/app/gpu/shaders.ts` as re-exports**

Replace the entire file with:

```typescript
// @ts-nocheck — Bun handles .wgsl as text imports
import FULLSCREEN_VERT from "../../../shaders/fullscreen.vert.wgsl";
import COLOR_SETTINGS_FRAG from "../../../shaders/color-settings.frag.wgsl";
import THRESHOLD_FRAG from "../../../shaders/threshold.frag.wgsl";
import BLUR_FRAG from "../../../shaders/blur.frag.wgsl";
import SCREEN_BLEND_FRAG from "../../../shaders/screen-blend.frag.wgsl";
import ABERRATION_FRAG from "../../../shaders/aberration.frag.wgsl";
import GRAIN_FRAG from "../../../shaders/grain.frag.wgsl";
import VIGNETTE_FRAG from "../../../shaders/vignette.frag.wgsl";
import SPLIT_TONE_FRAG from "../../../shaders/split-tone.frag.wgsl";
import CAMERA_SHAKE_FRAG from "../../../shaders/camera-shake.frag.wgsl";

export {
  FULLSCREEN_VERT,
  COLOR_SETTINGS_FRAG,
  THRESHOLD_FRAG,
  BLUR_FRAG,
  SCREEN_BLEND_FRAG,
  ABERRATION_FRAG,
  GRAIN_FRAG,
  VIGNETTE_FRAG,
  SPLIT_TONE_FRAG,
  CAMERA_SHAKE_FRAG,
};
```

- [ ] **Step 5: Add `.wgsl` text loader to `scripts/build-ui.ts`**

In the main UI `Bun.build` call (line 4), add the loader option:

```typescript
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "src", "ui", "app", "index.tsx")],
  outdir: join(import.meta.dir, "..", "src", "ui", "dist"),
  minify: true,
  target: "browser",
  loader: {
    ".wgsl": "text",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
```

- [ ] **Step 6: Build and verify browser still works**

Run: `bun run build:ui`

Expected: Build succeeds with no errors.

Run: `bun run src/cli.ts ui`

Expected: Browser preview works identically to before.

- [ ] **Step 7: Commit**

```bash
git add src/shaders/ src/ui/app/gpu/shaders.ts scripts/build-ui.ts
git commit -m "refactor: extract WGSL shaders to shared .wgsl files"
```

---

### Task 2: Scaffold Rust sidecar project

Create the Cargo project with dependencies and a minimal main that reads JSON from stdin and exits.

**Files:**
- Create: `sidecar/Cargo.toml`
- Create: `sidecar/src/main.rs`

- [ ] **Step 1: Create `sidecar/Cargo.toml`**

```toml
[package]
name = "hance-gpu"
version = "0.1.0"
edition = "2021"

[dependencies]
wgpu = "24"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
pollster = "0.4"

[profile.release]
opt-level = 3
lto = true
```

- [ ] **Step 2: Create `sidecar/src/main.rs` with init message parsing**

```rust
mod params;
mod passes;
mod renderer;

use std::io::{self, Read, Write};

fn read_init_message(stdin: &mut impl Read) -> io::Result<params::InitMessage> {
    let mut len_buf = [0u8; 4];
    stdin.read_exact(&mut len_buf)?;
    let len = u32::from_le_bytes(len_buf) as usize;

    let mut json_buf = vec![0u8; len];
    stdin.read_exact(&mut json_buf)?;

    serde_json::from_slice(&json_buf)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

fn main() {
    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();

    let init = match read_init_message(&mut stdin) {
        Ok(msg) => msg,
        Err(e) => {
            eprintln!("Failed to read init message: {e}");
            std::process::exit(1);
        }
    };

    let mut gpu = match renderer::GpuRenderer::new(init.width, init.height, &init.params) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("GPU init failed: {e}");
            std::process::exit(1);
        }
    };

    let frame_size = (init.width * init.height * 4) as usize;
    let mut frame_buf = vec![0u8; frame_size];

    loop {
        match stdin.read_exact(&mut frame_buf) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => break,
            Err(e) => {
                eprintln!("stdin read error: {e}");
                std::process::exit(1);
            }
        }

        let rendered = gpu.render_frame(&frame_buf);

        if let Err(e) = stdout.write_all(&rendered) {
            eprintln!("stdout write error: {e}");
            std::process::exit(1);
        }
        stdout.flush().unwrap();
    }
}
```

- [ ] **Step 3: Create stub modules so it compiles**

Create `sidecar/src/params.rs`:

```rust
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct InitMessage {
    pub width: u32,
    pub height: u32,
    pub params: HashMap<String, serde_json::Value>,
}
```

Create `sidecar/src/passes.rs`:

```rust
// Render pass helpers — implemented in Task 4
```

Create `sidecar/src/renderer.rs`:

```rust
use std::collections::HashMap;

pub struct GpuRenderer;

impl GpuRenderer {
    pub fn new(_width: u32, _height: u32, _params: &HashMap<String, serde_json::Value>) -> Result<Self, String> {
        Err("Not yet implemented".to_string())
    }

    pub fn render_frame(&mut self, _input: &[u8]) -> Vec<u8> {
        unimplemented!()
    }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd sidecar && cargo check`

Expected: Compiles with no errors (renderer will panic at runtime, that's fine).

- [ ] **Step 5: Commit**

```bash
git add sidecar/
git commit -m "feat(sidecar): scaffold Rust wgpu sidecar project"
```

---

### Task 3: Implement params module

Parse JSON params into typed uniform buffer data matching the WGSL structs.

**Files:**
- Modify: `sidecar/src/params.rs`

- [ ] **Step 1: Write tests for param extraction**

Add to the bottom of `sidecar/src/params.rs`:

```rust
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct InitMessage {
    pub width: u32,
    pub height: u32,
    pub params: HashMap<String, serde_json::Value>,
}

pub struct Params {
    map: HashMap<String, serde_json::Value>,
}

impl Params {
    pub fn new(map: HashMap<String, serde_json::Value>) -> Self {
        Self { map }
    }

    pub fn num(&self, key: &str, fallback: f32) -> f32 {
        self.map
            .get(key)
            .and_then(|v| v.as_f64())
            .map(|v| v as f32)
            .unwrap_or(fallback)
    }

    pub fn bool(&self, key: &str, fallback: bool) -> bool {
        self.map
            .get(key)
            .and_then(|v| v.as_bool())
            .unwrap_or(fallback)
    }

    pub fn str(&self, key: &str, fallback: &str) -> String {
        self.map
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| fallback.to_string())
    }

    /// Color settings uniform: [contrast, brightness, saturation, gamma, whiteBalance, tint, bleachBypass, 0]
    pub fn color_settings_uniform(&self) -> [f32; 8] {
        let fade = self.num("fade", 0.0);
        let contrast = self.num("contrast", 1.0) * (1.0 - fade);
        let brightness = self.num("exposure", 0.0) * 0.1 + fade * 0.05;
        let saturation = self.num("subtractive-sat", 1.0) * self.num("richness", 1.0);
        let gamma = 1.0 - self.num("highlights", 0.0) * 0.5;
        let wb = self.num("white-balance", 6500.0);
        let tint = self.num("tint", 0.0) / 100.0;
        let bleach = self.num("bleach-bypass", 0.0);
        [contrast, brightness, saturation, gamma, wb, tint, bleach, 0.0]
    }

    /// Identity color settings (passthrough)
    pub fn color_settings_identity() -> [f32; 8] {
        [1.0, 0.0, 1.0, 1.0, 6500.0, 0.0, 0.0, 0.0]
    }

    pub fn halation_enabled(&self) -> bool {
        !self.bool("no-halation", false) && self.num("halation-amount", 0.25) > 0.0
    }

    pub fn halation_amount(&self) -> f32 {
        self.num("halation-amount", 0.25)
    }

    pub fn halation_radius(&self) -> f32 {
        self.num("halation-radius", 4.0)
    }

    pub fn halation_highlights_only(&self) -> bool {
        self.bool("halation-highlights-only", true)
    }

    pub fn halation_hue(&self) -> f32 {
        self.num("halation-hue", 0.5) * 360.0
    }

    pub fn halation_saturation(&self) -> f32 {
        self.num("halation-saturation", 1.0)
    }

    pub fn aberration_enabled(&self) -> bool {
        !self.bool("no-aberration", false) && self.num("aberration", 0.3) > 0.0
    }

    pub fn aberration_offset(&self) -> f32 {
        self.num("aberration", 0.3) * 0.02
    }

    pub fn bloom_enabled(&self) -> bool {
        !self.bool("no-bloom", false) && self.num("bloom-amount", 0.25) > 0.0
    }

    pub fn bloom_amount(&self) -> f32 {
        self.num("bloom-amount", 0.25)
    }

    pub fn bloom_radius(&self) -> f32 {
        self.num("bloom-radius", 10.0)
    }

    pub fn grain_enabled(&self) -> bool {
        !self.bool("no-grain", false) && self.num("grain-amount", 0.125) > 0.0
    }

    /// Grain uniform: [amount, size, softness, saturation, defocus, time, texelW, texelH]
    pub fn grain_uniform(&self, frame_count: u32, width: u32, height: u32) -> [f32; 8] {
        [
            self.num("grain-amount", 0.125),
            self.num("grain-size", 0.0),
            self.num("grain-softness", 0.1),
            self.num("grain-saturation", 0.3),
            self.num("grain-defocus", 1.0),
            frame_count as f32,
            1.0 / width as f32,
            1.0 / height as f32,
        ]
    }

    pub fn vignette_enabled(&self) -> bool {
        !self.bool("no-vignette", false) && self.num("vignette-amount", 0.25) > 0.0
    }

    /// Vignette uniform: [angle, aspect, 0, 0]
    pub fn vignette_uniform(&self) -> [f32; 4] {
        let amount = self.num("vignette-amount", 0.25);
        let angle = amount * std::f32::consts::FRAC_PI_2;
        let aspect = 1.0 - self.num("vignette-size", 0.25) * 0.5;
        [angle, aspect, 0.0, 0.0]
    }

    pub fn split_tone_enabled(&self) -> bool {
        !self.bool("no-split-tone", false) && self.num("split-tone-amount", 0.0) > 0.0
    }

    /// Split tone uniform: [shadowR, shadowB, highlightR, highlightB, midR, amount, protect, 0]
    pub fn split_tone_uniform(&self) -> [f32; 8] {
        let amount = self.num("split-tone-amount", 0.0);
        let hue = self.num("split-tone-hue", 20.0);
        let pivot = self.num("split-tone-pivot", 0.3);
        let mode = self.str("split-tone-mode", "natural");
        let protect = if self.bool("split-tone-protect-neutrals", false) { 1.0 } else { 0.0 };

        let hue_rad = hue.to_radians();
        let cos_hue = hue_rad.cos();
        let sin_hue = hue_rad.sin();
        let shadow_r = cos_hue * amount * 0.3;
        let shadow_b = sin_hue * amount * 0.3;

        let highlight_scale = if mode == "complementary" { 0.3 } else { 0.15 };
        let (cos_hl, sin_hl) = if mode == "complementary" {
            (-cos_hue, -sin_hue)
        } else {
            (cos_hue, sin_hue)
        };
        let highlight_r = cos_hl * amount * highlight_scale;
        let highlight_b = sin_hl * amount * highlight_scale;
        let mid_r = pivot * -0.1;

        [shadow_r, shadow_b, highlight_r, highlight_b, mid_r, amount, protect, 0.0]
    }

    pub fn camera_shake_enabled(&self) -> bool {
        !self.bool("no-camera-shake", false) && self.num("camera-shake-amount", 0.25) > 0.0
    }

    /// Camera shake uniform: [amplitude, period1, period2, frame]
    pub fn camera_shake_uniform(&self, frame_count: u32, width: u32) -> [f32; 4] {
        let amount = self.num("camera-shake-amount", 0.25);
        let rate = self.num("camera-shake-rate", 0.5);
        let amplitude = (amount * 3.0) / width as f32;
        let period1 = (30.0 / (rate + 0.01)).max(1.0);
        let period2 = period1 * 1.3;
        [amplitude, period1, period2, frame_count as f32]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_params(pairs: &[(&str, serde_json::Value)]) -> Params {
        let map: HashMap<String, serde_json::Value> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect();
        Params::new(map)
    }

    #[test]
    fn color_settings_defaults() {
        let p = make_params(&[]);
        let u = p.color_settings_uniform();
        assert_eq!(u[0], 1.0); // contrast
        assert_eq!(u[1], 0.0); // brightness
        assert_eq!(u[2], 1.0); // saturation
        assert_eq!(u[3], 1.0); // gamma
        assert_eq!(u[4], 6500.0); // white balance
    }

    #[test]
    fn color_settings_with_fade() {
        let p = make_params(&[("fade", serde_json::json!(0.5))]);
        let u = p.color_settings_uniform();
        assert!((u[0] - 0.5).abs() < 0.001); // contrast * (1 - 0.5)
        assert!((u[1] - 0.025).abs() < 0.001); // 0 + 0.5 * 0.05
    }

    #[test]
    fn split_tone_natural_mode() {
        let p = make_params(&[
            ("split-tone-amount", serde_json::json!(1.0)),
            ("split-tone-hue", serde_json::json!(0.0)),
            ("split-tone-pivot", serde_json::json!(0.3)),
        ]);
        let u = p.split_tone_uniform();
        // hue=0 → cos=1, sin=0
        assert!((u[0] - 0.3).abs() < 0.001); // shadowR = cos(0)*1.0*0.3
        assert!((u[1] - 0.0).abs() < 0.001); // shadowB = sin(0)*1.0*0.3
        assert!((u[2] - 0.15).abs() < 0.001); // highlightR = cos(0)*1.0*0.15 (natural)
    }

    #[test]
    fn split_tone_complementary_mode() {
        let p = make_params(&[
            ("split-tone-amount", serde_json::json!(1.0)),
            ("split-tone-hue", serde_json::json!(0.0)),
            ("split-tone-mode", serde_json::json!("complementary")),
            ("split-tone-pivot", serde_json::json!(0.3)),
        ]);
        let u = p.split_tone_uniform();
        assert!((u[2] - (-0.3)).abs() < 0.001); // highlightR = -cos(0)*1.0*0.3
    }

    #[test]
    fn camera_shake_uniform_values() {
        let p = make_params(&[
            ("camera-shake-amount", serde_json::json!(1.0)),
            ("camera-shake-rate", serde_json::json!(0.5)),
        ]);
        let u = p.camera_shake_uniform(10, 1920);
        let expected_amplitude = 3.0 / 1920.0;
        assert!((u[0] - expected_amplitude).abs() < 0.0001);
        let expected_period1 = 30.0 / 0.51; // 30/(0.5+0.01)
        assert!((u[1] - expected_period1).abs() < 0.1);
        assert_eq!(u[3], 10.0); // frame count
    }

    #[test]
    fn init_message_deserialize() {
        let json = r#"{"width":1920,"height":1080,"params":{"contrast":1.2}}"#;
        let msg: InitMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.width, 1920);
        assert_eq!(msg.height, 1080);
        assert_eq!(msg.params.get("contrast").unwrap().as_f64().unwrap(), 1.2);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd sidecar && cargo test`

Expected: All tests in `params` module pass.

- [ ] **Step 3: Commit**

```bash
git add sidecar/src/params.rs
git commit -m "feat(sidecar): implement param parsing and uniform buffer packing"
```

---

### Task 4: Implement passes module

Utility functions for creating wgpu render pipelines, textures, bind groups, and running render passes.

**Files:**
- Modify: `sidecar/src/passes.rs`

- [ ] **Step 1: Implement passes module**

```rust
use wgpu::*;

pub fn create_standard_bind_group_layout(device: &Device) -> BindGroupLayout {
    device.create_bind_group_layout(&BindGroupLayoutDescriptor {
        label: Some("standard_layout"),
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

pub fn create_blend_bind_group_layout(device: &Device) -> BindGroupLayout {
    device.create_bind_group_layout(&BindGroupLayoutDescriptor {
        label: Some("blend_layout"),
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
                    view_dimension: TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            },
            BindGroupLayoutEntry {
                binding: 3,
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

pub fn create_pipeline(
    device: &Device,
    vertex_shader: &str,
    fragment_shader: &str,
    layout: &BindGroupLayout,
    format: TextureFormat,
) -> RenderPipeline {
    let vs_module = device.create_shader_module(ShaderModuleDescriptor {
        label: Some("vertex"),
        source: ShaderSource::Wgsl(vertex_shader.into()),
    });
    let fs_module = device.create_shader_module(ShaderModuleDescriptor {
        label: Some("fragment"),
        source: ShaderSource::Wgsl(fragment_shader.into()),
    });
    let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
        label: None,
        bind_group_layouts: &[layout],
        push_constant_ranges: &[],
    });
    device.create_render_pipeline(&RenderPipelineDescriptor {
        label: None,
        layout: Some(&pipeline_layout),
        vertex: VertexState {
            module: &vs_module,
            entry_point: Some("vs"),
            buffers: &[],
            compilation_options: Default::default(),
        },
        fragment: Some(FragmentState {
            module: &fs_module,
            entry_point: Some("fs"),
            targets: &[Some(ColorTargetState {
                format,
                blend: None,
                write_mask: ColorWrites::ALL,
            })],
            compilation_options: Default::default(),
        }),
        primitive: PrimitiveState {
            topology: PrimitiveTopology::TriangleList,
            ..Default::default()
        },
        depth_stencil: None,
        multisample: Default::default(),
        multiview: None,
        cache: None,
    })
}

pub fn create_texture(device: &Device, width: u32, height: u32, format: TextureFormat) -> Texture {
    device.create_texture(&TextureDescriptor {
        label: None,
        size: Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: TextureDimension::D2,
        format,
        usage: TextureUsages::TEXTURE_BINDING
            | TextureUsages::RENDER_ATTACHMENT
            | TextureUsages::COPY_DST
            | TextureUsages::COPY_SRC,
        view_formats: &[],
    })
}

pub fn create_uniform_buffer(device: &Device, size: u64) -> Buffer {
    let aligned = ((size + 15) / 16) * 16;
    device.create_buffer(&BufferDescriptor {
        label: None,
        size: aligned,
        usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}

pub fn make_std_bind_group(
    device: &Device,
    layout: &BindGroupLayout,
    texture: &TextureView,
    sampler: &Sampler,
    uniform: &Buffer,
) -> BindGroup {
    device.create_bind_group(&BindGroupDescriptor {
        label: None,
        layout,
        entries: &[
            BindGroupEntry { binding: 0, resource: BindingResource::TextureView(texture) },
            BindGroupEntry { binding: 1, resource: BindingResource::Sampler(sampler) },
            BindGroupEntry { binding: 2, resource: uniform.as_entire_binding() },
        ],
    })
}

pub fn make_blend_bind_group(
    device: &Device,
    layout: &BindGroupLayout,
    base: &TextureView,
    sampler: &Sampler,
    overlay: &TextureView,
    uniform: &Buffer,
) -> BindGroup {
    device.create_bind_group(&BindGroupDescriptor {
        label: None,
        layout,
        entries: &[
            BindGroupEntry { binding: 0, resource: BindingResource::TextureView(base) },
            BindGroupEntry { binding: 1, resource: BindingResource::Sampler(sampler) },
            BindGroupEntry { binding: 2, resource: BindingResource::TextureView(overlay) },
            BindGroupEntry { binding: 3, resource: uniform.as_entire_binding() },
        ],
    })
}

pub fn run_pass(
    encoder: &mut CommandEncoder,
    pipeline: &RenderPipeline,
    bind_group: &BindGroup,
    target: &TextureView,
) {
    let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
        label: None,
        color_attachments: &[Some(RenderPassColorAttachment {
            view: target,
            resolve_target: None,
            ops: Operations {
                load: LoadOp::Clear(Color { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }),
                store: StoreOp::Store,
            },
        })],
        depth_stencil_attachment: None,
        timestamp_writes: None,
        occlusion_query_set: None,
    });
    pass.set_pipeline(pipeline);
    pass.set_bind_group(0, bind_group, &[]);
    pass.draw(3, 1, 0, 0);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd sidecar && cargo check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add sidecar/src/passes.rs
git commit -m "feat(sidecar): implement wgpu render pass utilities"
```

---

### Task 5: Implement renderer module

The core GPU renderer that initializes wgpu and runs the effect chain, mirroring `src/ui/app/gpu/renderer.ts`.

**Files:**
- Modify: `sidecar/src/renderer.rs`

- [ ] **Step 1: Implement GpuRenderer**

```rust
use std::collections::HashMap;
use wgpu::*;

use crate::params::Params;
use crate::passes;

const VERT: &str = include_str!("../../src/shaders/fullscreen.vert.wgsl");
const COLOR_FRAG: &str = include_str!("../../src/shaders/color-settings.frag.wgsl");
const THRESHOLD_FRAG: &str = include_str!("../../src/shaders/threshold.frag.wgsl");
const BLUR_FRAG: &str = include_str!("../../src/shaders/blur.frag.wgsl");
const BLEND_FRAG: &str = include_str!("../../src/shaders/screen-blend.frag.wgsl");
const ABERRATION_FRAG: &str = include_str!("../../src/shaders/aberration.frag.wgsl");
const GRAIN_FRAG: &str = include_str!("../../src/shaders/grain.frag.wgsl");
const VIGNETTE_FRAG: &str = include_str!("../../src/shaders/vignette.frag.wgsl");
const SPLIT_TONE_FRAG: &str = include_str!("../../src/shaders/split-tone.frag.wgsl");
const SHAKE_FRAG: &str = include_str!("../../src/shaders/camera-shake.frag.wgsl");

const FORMAT: TextureFormat = TextureFormat::Rgba8Unorm;

pub struct GpuRenderer {
    device: Device,
    queue: Queue,
    width: u32,
    height: u32,
    params: Params,
    frame_count: u32,

    // Textures
    src_tex: Texture,
    tex_a: Texture,
    tex_b: Texture,
    half_a: Texture,
    half_b: Texture,

    // Layouts
    std_layout: BindGroupLayout,
    blend_layout: BindGroupLayout,
    sampler: Sampler,

    // Pipelines
    color_pipeline: RenderPipeline,
    threshold_pipeline: RenderPipeline,
    blur_pipeline: RenderPipeline,
    blend_pipeline: RenderPipeline,
    aberration_pipeline: RenderPipeline,
    grain_pipeline: RenderPipeline,
    vignette_pipeline: RenderPipeline,
    split_tone_pipeline: RenderPipeline,
    shake_pipeline: RenderPipeline,

    // Uniform buffers
    color_ub: Buffer,
    threshold_ub: Buffer,
    blur_ub1: Buffer,
    blur_ub2: Buffer,
    blend_ub: Buffer,
    aberration_ub: Buffer,
    grain_ub: Buffer,
    vignette_ub: Buffer,
    split_tone_ub: Buffer,
    shake_ub: Buffer,
    bloom_blur_ub1: Buffer,
    bloom_blur_ub2: Buffer,
    bloom_blend_ub: Buffer,

    // Readback
    staging_buf: Buffer,
}

impl GpuRenderer {
    pub fn new(width: u32, height: u32, raw_params: &HashMap<String, serde_json::Value>) -> Result<Self, String> {
        let instance = Instance::new(&InstanceDescriptor {
            backends: Backends::all(),
            ..Default::default()
        });

        let adapter = pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            ..Default::default()
        }))
        .ok_or("No GPU adapter found")?;

        let (device, queue) = pollster::block_on(adapter.request_device(&DeviceDescriptor {
            label: Some("hance-gpu"),
            ..Default::default()
        }, None))
        .map_err(|e| format!("Device request failed: {e}"))?;

        let sampler = device.create_sampler(&SamplerDescriptor {
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            ..Default::default()
        });

        let std_layout = passes::create_standard_bind_group_layout(&device);
        let blend_layout = passes::create_blend_bind_group_layout(&device);

        let half_w = (width / 2).max(1);
        let half_h = (height / 2).max(1);

        let src_tex = device.create_texture(&TextureDescriptor {
            label: Some("src"),
            size: Extent3d { width, height, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8Unorm,
            usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let tex_a = passes::create_texture(&device, width, height, FORMAT);
        let tex_b = passes::create_texture(&device, width, height, FORMAT);
        let half_a = passes::create_texture(&device, half_w, half_h, FORMAT);
        let half_b = passes::create_texture(&device, half_w, half_h, FORMAT);

        let color_pipeline = passes::create_pipeline(&device, VERT, COLOR_FRAG, &std_layout, FORMAT);
        let threshold_pipeline = passes::create_pipeline(&device, VERT, THRESHOLD_FRAG, &std_layout, FORMAT);
        let blur_pipeline = passes::create_pipeline(&device, VERT, BLUR_FRAG, &std_layout, FORMAT);
        let blend_pipeline = passes::create_pipeline(&device, VERT, BLEND_FRAG, &blend_layout, FORMAT);
        let aberration_pipeline = passes::create_pipeline(&device, VERT, ABERRATION_FRAG, &std_layout, FORMAT);
        let grain_pipeline = passes::create_pipeline(&device, VERT, GRAIN_FRAG, &std_layout, FORMAT);
        let vignette_pipeline = passes::create_pipeline(&device, VERT, VIGNETTE_FRAG, &std_layout, FORMAT);
        let split_tone_pipeline = passes::create_pipeline(&device, VERT, SPLIT_TONE_FRAG, &std_layout, FORMAT);
        let shake_pipeline = passes::create_pipeline(&device, VERT, SHAKE_FRAG, &std_layout, FORMAT);

        let color_ub = passes::create_uniform_buffer(&device, 32);
        let threshold_ub = passes::create_uniform_buffer(&device, 16);
        let blur_ub1 = passes::create_uniform_buffer(&device, 16);
        let blur_ub2 = passes::create_uniform_buffer(&device, 16);
        let blend_ub = passes::create_uniform_buffer(&device, 16);
        let aberration_ub = passes::create_uniform_buffer(&device, 16);
        let grain_ub = passes::create_uniform_buffer(&device, 32);
        let vignette_ub = passes::create_uniform_buffer(&device, 16);
        let split_tone_ub = passes::create_uniform_buffer(&device, 32);
        let shake_ub = passes::create_uniform_buffer(&device, 16);
        let bloom_blur_ub1 = passes::create_uniform_buffer(&device, 16);
        let bloom_blur_ub2 = passes::create_uniform_buffer(&device, 16);
        let bloom_blend_ub = passes::create_uniform_buffer(&device, 16);

        let bytes_per_row = ((width * 4 + 255) / 256) * 256;
        let staging_buf = device.create_buffer(&BufferDescriptor {
            label: Some("staging"),
            size: (bytes_per_row * height) as u64,
            usage: BufferUsages::COPY_DST | BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        Ok(Self {
            device,
            queue,
            width,
            height,
            params: Params::new(raw_params.clone()),
            frame_count: 0,
            src_tex,
            tex_a,
            tex_b,
            half_a,
            half_b,
            std_layout,
            blend_layout,
            sampler,
            color_pipeline,
            threshold_pipeline,
            blur_pipeline,
            blend_pipeline,
            aberration_pipeline,
            grain_pipeline,
            vignette_pipeline,
            split_tone_pipeline,
            shake_pipeline,
            color_ub,
            threshold_ub,
            blur_ub1,
            blur_ub2,
            blend_ub,
            aberration_ub,
            grain_ub,
            vignette_ub,
            split_tone_ub,
            shake_ub,
            bloom_blur_ub1,
            bloom_blur_ub2,
            bloom_blend_ub,
            staging_buf,
        })
    }

    fn write_uniform(&self, buffer: &Buffer, data: &[f32]) {
        self.queue.write_buffer(buffer, 0, bytemuck_cast(data));
    }

    pub fn render_frame(&mut self, input: &[u8]) -> Vec<u8> {
        self.frame_count += 1;

        // Upload source
        self.queue.write_texture(
            ImageCopyTexture {
                texture: &self.src_tex,
                mip_level: 0,
                origin: Origin3d::ZERO,
                aspect: TextureAspect::All,
            },
            input,
            ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(self.width * 4),
                rows_per_image: Some(self.height),
            },
            Extent3d { width: self.width, height: self.height, depth_or_array_layers: 1 },
        );

        let mut encoder = self.device.create_command_encoder(&CommandEncoderDescriptor { label: None });

        // We track "current" and "other" by index: false=tex_a, true=tex_b
        let mut current_is_b = false;

        macro_rules! current_tex { () => { if current_is_b { &self.tex_b } else { &self.tex_a } } }
        macro_rules! other_tex { () => { if current_is_b { &self.tex_a } else { &self.tex_b } } }
        macro_rules! swap { () => { current_is_b = !current_is_b; } }

        let half_w = (self.width / 2).max(1);
        let half_h = (self.height / 2).max(1);

        // --- Color Settings ---
        if !self.params.bool("no-color-settings", false) {
            self.write_uniform(&self.color_ub, &self.params.color_settings_uniform());
        } else {
            self.write_uniform(&self.color_ub, &Params::color_settings_identity());
        }
        let bg = passes::make_std_bind_group(
            &self.device, &self.std_layout,
            &self.src_tex.create_view(&TextureViewDescriptor::default()),
            &self.sampler, &self.color_ub,
        );
        passes::run_pass(&mut encoder, &self.color_pipeline, &bg,
            &current_tex!().create_view(&TextureViewDescriptor::default()));

        // --- Halation ---
        if self.params.halation_enabled() {
            let amount = self.params.halation_amount();
            let radius = self.params.halation_radius();
            let sigma = radius * 0.5;

            if self.params.halation_highlights_only() {
                self.write_uniform(&self.threshold_ub, &[0.65, 0.75, 0.0, 0.0]);
                let bg = passes::make_std_bind_group(
                    &self.device, &self.std_layout,
                    &current_tex!().create_view(&TextureViewDescriptor::default()),
                    &self.sampler, &self.threshold_ub,
                );
                passes::run_pass(&mut encoder, &self.threshold_pipeline, &bg,
                    &self.half_a.create_view(&TextureViewDescriptor::default()));
            } else {
                self.write_uniform(&self.blur_ub1, &[0.0, 0.0, 0.001, 0.0]);
                let bg = passes::make_std_bind_group(
                    &self.device, &self.std_layout,
                    &current_tex!().create_view(&TextureViewDescriptor::default()),
                    &self.sampler, &self.blur_ub1,
                );
                passes::run_pass(&mut encoder, &self.blur_pipeline, &bg,
                    &self.half_a.create_view(&TextureViewDescriptor::default()));
            }

            // H-blur → halfB
            self.write_uniform(&self.blur_ub1, &[1.0 / half_w as f32, 0.0, sigma, 0.0]);
            let h_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.blur_ub1,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &h_bg,
                &self.half_b.create_view(&TextureViewDescriptor::default()));

            // V-blur → halfA
            self.write_uniform(&self.blur_ub2, &[0.0, 1.0 / half_h as f32, sigma, 0.0]);
            let v_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_b.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.blur_ub2,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &v_bg,
                &self.half_a.create_view(&TextureViewDescriptor::default()));

            // Screen blend
            let hue = self.params.halation_hue();
            let sat = self.params.halation_saturation();
            self.write_uniform(&self.blend_ub, &[amount, hue, sat, 0.0]);
            let blend_bg = passes::make_blend_bind_group(
                &self.device, &self.blend_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.blend_ub,
            );
            passes::run_pass(&mut encoder, &self.blend_pipeline, &blend_bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Chromatic Aberration ---
        if self.params.aberration_enabled() {
            let offset = self.params.aberration_offset();
            self.write_uniform(&self.aberration_ub, &[offset, 0.0, 0.0, 0.0]);
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.aberration_ub,
            );
            passes::run_pass(&mut encoder, &self.aberration_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Bloom ---
        if self.params.bloom_enabled() {
            let amount = self.params.bloom_amount();
            let radius = self.params.bloom_radius();
            let sigma = radius * 0.5;

            // Downsample
            self.write_uniform(&self.blur_ub1, &[0.0, 0.0, 0.001, 0.0]);
            let ds_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.blur_ub1,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &ds_bg,
                &self.half_a.create_view(&TextureViewDescriptor::default()));

            // H-blur → halfB
            self.write_uniform(&self.bloom_blur_ub1, &[1.0 / half_w as f32, 0.0, sigma, 0.0]);
            let h_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.bloom_blur_ub1,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &h_bg,
                &self.half_b.create_view(&TextureViewDescriptor::default()));

            // V-blur → halfA
            self.write_uniform(&self.bloom_blur_ub2, &[0.0, 1.0 / half_h as f32, sigma, 0.0]);
            let v_bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &self.half_b.create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.bloom_blur_ub2,
            );
            passes::run_pass(&mut encoder, &self.blur_pipeline, &v_bg,
                &self.half_a.create_view(&TextureViewDescriptor::default()));

            // Screen blend
            self.write_uniform(&self.bloom_blend_ub, &[amount, 0.0, 1.0, 0.0]);
            let blend_bg = passes::make_blend_bind_group(
                &self.device, &self.blend_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler,
                &self.half_a.create_view(&TextureViewDescriptor::default()),
                &self.bloom_blend_ub,
            );
            passes::run_pass(&mut encoder, &self.blend_pipeline, &blend_bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Grain ---
        if self.params.grain_enabled() {
            self.write_uniform(&self.grain_ub, &self.params.grain_uniform(self.frame_count, self.width, self.height));
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.grain_ub,
            );
            passes::run_pass(&mut encoder, &self.grain_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Vignette ---
        if self.params.vignette_enabled() {
            self.write_uniform(&self.vignette_ub, &self.params.vignette_uniform());
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.vignette_ub,
            );
            passes::run_pass(&mut encoder, &self.vignette_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Split Tone ---
        if self.params.split_tone_enabled() {
            self.write_uniform(&self.split_tone_ub, &self.params.split_tone_uniform());
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.split_tone_ub,
            );
            passes::run_pass(&mut encoder, &self.split_tone_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Camera Shake ---
        if self.params.camera_shake_enabled() {
            self.write_uniform(&self.shake_ub, &self.params.camera_shake_uniform(self.frame_count, self.width));
            let bg = passes::make_std_bind_group(
                &self.device, &self.std_layout,
                &current_tex!().create_view(&TextureViewDescriptor::default()),
                &self.sampler, &self.shake_ub,
            );
            passes::run_pass(&mut encoder, &self.shake_pipeline, &bg,
                &other_tex!().create_view(&TextureViewDescriptor::default()));
            swap!();
        }

        // --- Readback ---
        let bytes_per_row = ((self.width * 4 + 255) / 256) * 256;
        encoder.copy_texture_to_buffer(
            ImageCopyTexture {
                texture: current_tex!(),
                mip_level: 0,
                origin: Origin3d::ZERO,
                aspect: TextureAspect::All,
            },
            ImageCopyBuffer {
                buffer: &self.staging_buf,
                layout: ImageDataLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row),
                    rows_per_image: Some(self.height),
                },
            },
            Extent3d { width: self.width, height: self.height, depth_or_array_layers: 1 },
        );

        self.queue.submit(std::iter::once(encoder.finish()));

        // Map and read back
        let slice = self.staging_buf.slice(..);
        slice.map_async(MapMode::Read, |_| {});
        self.device.poll(Maintain::Wait);

        let mapped = slice.get_mapped_range();
        let mut result = vec![0u8; (self.width * self.height * 4) as usize];
        for y in 0..self.height {
            let src_offset = (y * bytes_per_row) as usize;
            let dst_offset = (y * self.width * 4) as usize;
            let row_bytes = (self.width * 4) as usize;
            result[dst_offset..dst_offset + row_bytes]
                .copy_from_slice(&mapped[src_offset..src_offset + row_bytes]);
        }
        drop(mapped);
        self.staging_buf.unmap();

        result
    }
}

/// Cast &[f32] to &[u8] for uniform buffer writes
fn bytemuck_cast(data: &[f32]) -> &[u8] {
    unsafe { std::slice::from_raw_parts(data.as_ptr() as *const u8, data.len() * 4) }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd sidecar && cargo check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add sidecar/src/renderer.rs
git commit -m "feat(sidecar): implement wgpu renderer with full effect chain"
```

---

### Task 6: Build and smoke-test the sidecar

Verify the Rust binary compiles and can process a frame.

**Files:**
- No new files

- [ ] **Step 1: Build release binary**

Run: `cd sidecar && cargo build --release`

Expected: Builds successfully. Binary at `sidecar/target/release/hance-gpu`.

- [ ] **Step 2: Write a quick smoke test script**

Create `sidecar/tests/smoke.rs`:

```rust
use std::io::Write;
use std::process::{Command, Stdio};

#[test]
fn sidecar_processes_one_frame() {
    let binary = env!("CARGO_BIN_EXE_hance-gpu");

    let mut child = Command::new(binary)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to spawn sidecar");

    let width: u32 = 4;
    let height: u32 = 4;
    let frame_size = (width * height * 4) as usize;

    // Send init message
    let init_json = serde_json::json!({
        "width": width,
        "height": height,
        "params": {}
    });
    let init_bytes = serde_json::to_vec(&init_json).unwrap();
    let len_bytes = (init_bytes.len() as u32).to_le_bytes();

    let stdin = child.stdin.as_mut().unwrap();
    stdin.write_all(&len_bytes).unwrap();
    stdin.write_all(&init_bytes).unwrap();

    // Send one red frame
    let mut frame = vec![0u8; frame_size];
    for i in 0..(width * height) as usize {
        frame[i * 4] = 255;     // R
        frame[i * 4 + 1] = 0;   // G
        frame[i * 4 + 2] = 0;   // B
        frame[i * 4 + 3] = 255; // A
    }
    stdin.write_all(&frame).unwrap();

    // Close stdin to signal end
    drop(child.stdin.take());

    let output = child.wait_with_output().expect("Failed to read output");

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        panic!("Sidecar failed: {stderr}");
    }

    assert_eq!(output.stdout.len(), frame_size, "Output frame size mismatch");
}
```

- [ ] **Step 3: Run the smoke test**

Run: `cd sidecar && cargo test --release`

Expected: `sidecar_processes_one_frame` passes.

- [ ] **Step 4: Commit**

```bash
git add sidecar/tests/smoke.rs
git commit -m "test(sidecar): add smoke test for single-frame processing"
```

---

### Task 7: Create Bun-side wgpu renderer

Replace the Playwright headless renderer with a module that spawns the Rust sidecar.

**Files:**
- Create: `src/gpu/wgpu-renderer.ts`

- [ ] **Step 1: Implement `src/gpu/wgpu-renderer.ts`**

```typescript
import { join } from "node:path";

export interface HeadlessRenderer {
  init(width: number, height: number): Promise<void>;
  renderFrame(
    rgba: Uint8Array,
    width: number,
    height: number,
    params: Record<string, unknown>,
  ): Promise<Uint8Array>;
  close(): Promise<void>;
}

export async function createHeadlessRenderer(): Promise<HeadlessRenderer> {
  let proc: ReturnType<typeof Bun.spawn> | null = null;
  let frameSize = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let readBuffer = new Uint8Array(0);

  function sidecarPath(): string {
    // Check for bundled binary next to CLI, then fall back to dev path
    const devPath = join(import.meta.dir, "..", "..", "sidecar", "target", "release", "hance-gpu");
    return devPath;
  }

  async function readExactly(n: number): Promise<Uint8Array> {
    while (readBuffer.length < n) {
      const { done, value } = await reader!.read();
      if (done) throw new Error("Sidecar stdout closed unexpectedly");
      const combined = new Uint8Array(readBuffer.length + value.length);
      combined.set(readBuffer);
      combined.set(value, readBuffer.length);
      readBuffer = combined;
    }
    const result = readBuffer.slice(0, n);
    readBuffer = readBuffer.slice(n);
    return result;
  }

  async function init(width: number, height: number): Promise<void> {
    frameSize = width * height * 4;

    proc = Bun.spawn([sidecarPath()], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    reader = proc.stdout.getReader();

    // Send init message: 4-byte LE length + JSON
    const initMsg = JSON.stringify({ width, height, params: {} });
    const initBytes = new TextEncoder().encode(initMsg);
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, initBytes.length, true);

    proc.stdin.write(lenBuf);
    proc.stdin.write(initBytes);
  }

  async function renderFrame(
    rgba: Uint8Array,
    _width: number,
    _height: number,
    params: Record<string, unknown>,
  ): Promise<Uint8Array> {
    if (!proc) throw new Error("Renderer not initialized");

    // Note: params are sent in init message. For per-frame params we'd need
    // a protocol extension. For now, params are fixed at init time.
    // TODO: If per-frame param updates are needed, extend the protocol.

    proc.stdin.write(rgba);

    return readExactly(frameSize);
  }

  async function close(): Promise<void> {
    if (proc) {
      proc.stdin.end();
      await proc.exited;
      proc = null;
      reader = null;
    }
  }

  return { init, renderFrame, close };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/gpu/wgpu-renderer.ts
git commit -m "feat(gpu): add wgpu sidecar renderer for headless export"
```

---

### Task 8: Wire up wgpu renderer and remove Playwright

Update imports across the codebase to use the new renderer, delete old files, remove Playwright dependency.

**Files:**
- Modify: `src/pipeline.ts`
- Modify: `src/cli.ts`
- Modify: `src/__tests__/gpu/headless-renderer.test.ts`
- Modify: `src/__tests__/e2e/gpu-export.test.ts`
- Modify: `scripts/build-ui.ts`
- Modify: `package.json`
- Delete: `src/gpu/headless-renderer.ts`
- Delete: `src/gpu/render-worker-entry.ts`
- Delete: `src/gpu/render-worker.html`

- [ ] **Step 1: Update `src/pipeline.ts` import**

Change line 2 from:

```typescript
import { createHeadlessRenderer } from "./gpu/headless-renderer";
```

to:

```typescript
import { createHeadlessRenderer } from "./gpu/wgpu-renderer";
```

- [ ] **Step 2: Update `src/cli.ts` import**

Change line 303 from:

```typescript
const { createHeadlessRenderer } = await import("./gpu/headless-renderer");
```

to:

```typescript
const { createHeadlessRenderer } = await import("./gpu/wgpu-renderer");
```

- [ ] **Step 3: Update `src/__tests__/gpu/headless-renderer.test.ts`**

Change lines 2-5 from:

```typescript
import {
  createHeadlessRenderer,
  type HeadlessRenderer,
} from "../../gpu/headless-renderer";
```

to:

```typescript
import {
  createHeadlessRenderer,
  type HeadlessRenderer,
} from "../../gpu/wgpu-renderer";
```

Also update the assertion on line 29 — the wgpu renderer returns raw RGBA (not PNG), so change:

```typescript
    expect(result.length).toBeGreaterThan(0); // PNG bytes, not raw RGBA
```

to:

```typescript
    expect(result.length).toBe(2 * 2 * 4); // Raw RGBA output
```

- [ ] **Step 4: Update `src/__tests__/e2e/gpu-export.test.ts`**

Change line 2 from:

```typescript
import { createHeadlessRenderer } from "../../gpu/headless-renderer";
```

to:

```typescript
import { createHeadlessRenderer } from "../../gpu/wgpu-renderer";
```

- [ ] **Step 5: Remove render-worker build from `scripts/build-ui.ts`**

Delete lines 28-49 (the entire "Build render worker" section) from `scripts/build-ui.ts`. After the change, the file should end after `console.log("UI built successfully");`.

- [ ] **Step 6: Remove Playwright from `package.json`**

Remove the `"@playwright/test"` line from `devDependencies` and remove the `"test:e2e:ui"` script. Also add the `build:gpu` script:

```json
{
  "scripts": {
    "start": "bun run src/cli.ts",
    "build": "bun run build:gpu && bun run build:ui && bun build src/cli.ts --compile --outfile hance",
    "build:ui": "bun run scripts/build-ui.ts",
    "build:gpu": "cd sidecar && cargo build --release",
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "^1.3.11",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  }
}
```

- [ ] **Step 7: Delete old files**

```bash
rm src/gpu/headless-renderer.ts
rm src/gpu/render-worker-entry.ts
rm src/gpu/render-worker.html
rm -rf src/gpu/dist/
```

- [ ] **Step 8: Verify build**

Run: `bun run build:ui`

Expected: Succeeds (no more render-worker build).

- [ ] **Step 9: Run tests**

Run: `bun test src/__tests__/gpu/headless-renderer.test.ts`

Expected: PASS (requires sidecar binary built in Task 6).

Run: `bun test src/__tests__/e2e/gpu-export.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: replace Playwright headless renderer with wgpu sidecar"
```

---

### Task 9: Update pipeline for raw RGBA encoding

The current pipeline sends PNG frames to FFmpeg encoder. With the wgpu sidecar returning raw RGBA, update the encoder to accept rawvideo input.

**Files:**
- Modify: `src/pipeline.ts`

- [ ] **Step 1: Update encoder FFmpeg args in `src/pipeline.ts`**

Change lines 28-38 from:

```typescript
  const encoder = Bun.spawn([
    "ffmpeg", "-y",
    "-f", "image2pipe", "-framerate", `${fps}`,
    "-i", "pipe:0",
    "-i", input,
    "-map", "0:v", "-map", "1:a?",
    "-c:a", "copy",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p",
    output,
  ], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
```

to:

```typescript
  const encoder = Bun.spawn([
    "ffmpeg", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${width}x${height}`, "-r", `${fps}`,
    "-i", "pipe:0",
    "-i", input,
    "-map", "0:v", "-map", "1:a?",
    "-c:a", "copy",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p",
    output,
  ], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
```

- [ ] **Step 2: Test video export**

Run: `bun run src/cli.ts <test-video> -o /tmp/test-output.mp4`

Expected: Video exports successfully with effects applied.

- [ ] **Step 3: Commit**

```bash
git add src/pipeline.ts
git commit -m "fix(pipeline): accept raw RGBA from wgpu sidecar instead of PNG"
```

---

### Task 10: End-to-end validation

Run the full test suite and verify everything works.

**Files:**
- No new files

- [ ] **Step 1: Build everything**

Run: `cd sidecar && cargo build --release && cd .. && bun run build:ui`

Expected: Both builds succeed.

- [ ] **Step 2: Run all Rust tests**

Run: `cd sidecar && cargo test --release`

Expected: All pass.

- [ ] **Step 3: Run all Bun tests**

Run: `bun test`

Expected: All pass.

- [ ] **Step 4: Test CLI image export**

Run: `bun run src/cli.ts <test-image> -o /tmp/test-output.png`

Expected: Image exports with effects applied.

- [ ] **Step 5: Test CLI video export**

Run: `bun run src/cli.ts <test-video> -o /tmp/test-output.mp4`

Expected: Video exports with effects, audio intact, progress shown.

- [ ] **Step 6: Test UI preview**

Run: `bun run src/cli.ts ui`

Expected: Browser preview still works (shaders loaded from `.wgsl` files).

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Extract WGSL shaders to shared `.wgsl` files | None |
| 2 | Scaffold Rust sidecar project | None |
| 3 | Implement params module | Task 2 |
| 4 | Implement passes module | Task 2 |
| 5 | Implement renderer module | Tasks 1, 3, 4 |
| 6 | Build and smoke-test sidecar | Task 5 |
| 7 | Create Bun-side wgpu renderer | None |
| 8 | Wire up and remove Playwright | Tasks 6, 7 |
| 9 | Update pipeline for raw RGBA | Task 8 |
| 10 | End-to-end validation | Task 9 |

Tasks 1, 2, 7 can be done in parallel. Tasks 3-4 follow Task 2. Task 5 needs 1+3+4. Tasks 8-10 are sequential integration.
