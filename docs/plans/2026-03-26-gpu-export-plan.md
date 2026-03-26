# GPU Export Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the FFmpeg filter graph with GPU rendering so export output is pixel-perfect with the web preview.

**Architecture:** Image export becomes pure client-side canvas download. Video export uses FFmpeg (decode only) → headless Chrome (GPU render with existing shaders) → FFmpeg (encode + audio mux). The `src/effects/` FFmpeg filter modules are deleted entirely.

**Tech Stack:** Bun, TypeScript, Playwright (headless Chrome), WebGPU, FFmpeg (codec only)

---

### Task 1: Client-side image export

Replace the server round-trip image export with a direct canvas download in the browser.

**Files:**
- Modify: `src/ui/app/App.tsx`
- Modify: `src/ui/app/components/RenderBar.tsx`
- Modify: `src/ui/app/components/VideoPlayer.tsx`
- Test: manual — export image, verify it matches preview

**Step 1: Expose canvas ref from VideoPlayer**

In `src/ui/app/components/VideoPlayer.tsx`, add a prop to expose the canvas ref:

```typescript
interface Props {
  src: string;
  isVideo: boolean;
  params: PreviewParams;
  onRendererReady: (renderer: Renderer) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}
```

Call `onCanvasReady` after the canvas is mounted:

```typescript
useEffect(() => {
  if (canvasRef.current && onCanvasReady) {
    onCanvasReady(canvasRef.current);
  }
}, [onCanvasReady]);
```

**Step 2: Store canvas ref in App.tsx**

In `src/ui/app/App.tsx`, add a canvas ref and pass it down:

```typescript
const canvasRef = useRef<HTMLCanvasElement | null>(null);

const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
  canvasRef.current = canvas;
}, []);
```

Pass to VideoPlayer:

```typescript
<VideoPlayer
  src={objectUrl}
  isVideo={isVideo}
  params={params}
  onRendererReady={handleRendererReady}
  onCanvasReady={handleCanvasReady}
/>
```

Pass canvas and isVideo to RenderBar:

```typescript
{file && <RenderBar file={file} params={params} canvas={canvasRef.current} isVideo={isVideo} />}
```

**Step 3: Add client-side image download to RenderBar**

In `src/ui/app/components/RenderBar.tsx`, update the Props interface:

```typescript
interface Props {
  file: File;
  params: Record<string, string | number | boolean>;
  canvas: HTMLCanvasElement | null;
  isVideo: boolean;
}
```

Add a client-side image export function before the existing `startExport`:

```typescript
const downloadImage = useCallback(() => {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.[^.]+$/, "_openhanced.png");
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}, [canvas, file.name]);
```

Update the Export button to route based on `isVideo`:

```typescript
{state === "idle" && (
  <button
    onClick={isVideo ? startExport : downloadImage}
    style={{
      width: "100%", padding: "8px 16px", background: "#2563eb", color: "#fff",
      border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
    }}
  >
    {isVideo ? "Export" : "Download"}
  </button>
)}
```

**Step 4: Build and test**

Run: `bun run build:ui && bun run src/cli.ts ui`

Test: Open browser, load an image, apply effects, click Download. Verify the downloaded PNG matches the preview exactly.

**Step 5: Commit**

```bash
git add src/ui/app/App.tsx src/ui/app/components/RenderBar.tsx src/ui/app/components/VideoPlayer.tsx
git commit -m "feat(ui): client-side image export via canvas download"
```

---

### Task 2: Extend probe to return video dimensions and fps

The headless video export needs width, height, fps, and total frame count.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/probe.ts`
- Modify: `src/__tests__/probe.test.ts` (if exists, else create)

**Step 1: Write the failing test**

Create or update `src/__tests__/probe.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { parseProbeOutput } from "../probe";

describe("parseProbeOutput", () => {
  it("parses video metadata including dimensions and fps", () => {
    const output = `codec_name=h264
width=1920
height=1080
r_frame_rate=30/1
duration=60.000000`;
    const result = parseProbeOutput(output);
    expect(result.isImage).toBe(false);
    expect(result.duration).toBe(60);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.fps).toBe(30);
  });

  it("parses fractional fps", () => {
    const output = `codec_name=h264
width=1280
height=720
r_frame_rate=24000/1001
duration=120.5`;
    const result = parseProbeOutput(output);
    expect(result.fps).toBeCloseTo(23.976, 2);
  });

  it("returns null dimensions for images", () => {
    const output = `codec_name=png
width=2728
height=1534`;
    const result = parseProbeOutput(output);
    expect(result.isImage).toBe(true);
    expect(result.width).toBe(2728);
    expect(result.height).toBe(1534);
    expect(result.fps).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/probe.test.ts`

Expected: FAIL — `width`, `height`, `fps` not in ProbeResult

**Step 3: Update ProbeResult type**

In `src/types.ts`, update:

```typescript
export interface ProbeResult {
  duration: number | null;
  isImage: boolean;
  width: number | null;
  height: number | null;
  fps: number | null;
}
```

**Step 4: Update parseProbeOutput**

In `src/probe.ts`, add parsing for new fields:

```typescript
export function parseProbeOutput(output: string): ProbeResult {
  const lines = output.trim().split("\n");
  let duration: number | null = null;
  let codec: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let fps: number | null = null;

  for (const line of lines) {
    const [key, value] = line.split("=");
    if (key === "duration" && value && value !== "N/A") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) duration = parsed;
    }
    if (key === "codec_name" && value) {
      codec = value.trim();
    }
    if (key === "width" && value) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) width = parsed;
    }
    if (key === "height" && value) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) height = parsed;
    }
    if (key === "r_frame_rate" && value) {
      const parts = value.trim().split("/");
      if (parts.length === 2) {
        const num = parseInt(parts[0], 10);
        const den = parseInt(parts[1], 10);
        if (den > 0) fps = num / den;
      }
    }
  }

  const isImage = duration === null || (codec !== null && IMAGE_CODECS.has(codec));

  return { duration, isImage, width, height, fps };
}
```

**Step 5: Update ffprobe command to request new fields**

In `src/probe.ts`, update the `probe()` function's show_entries:

```typescript
"-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate",
```

**Step 6: Run tests**

Run: `bun test src/__tests__/probe.test.ts`

Expected: PASS

Run: `bun test`

Expected: All pass (fix any tests that depend on ProbeResult shape)

**Step 7: Commit**

```bash
git add src/types.ts src/probe.ts src/__tests__/probe.test.ts
git commit -m "feat(probe): add width, height, fps to probe result"
```

---

### Task 3: Add writeTexture source path to renderer

The headless renderer needs to accept raw RGBA buffers instead of HTML elements.

**Files:**
- Modify: `src/ui/app/gpu/renderer.ts`

**Step 1: Add setSourceFromBuffer to Renderer interface**

In `src/ui/app/gpu/renderer.ts`, update the Renderer interface:

```typescript
export interface Renderer {
  setSource(source: HTMLVideoElement | HTMLImageElement): void;
  setSourceFromBuffer(data: Uint8Array, width: number, height: number): void;
  setParams(params: PreviewParams): void;
  renderFrame(): void;
  destroy(): void;
}
```

**Step 2: Implement setSourceFromBuffer**

Inside `createRenderer()`, add a variable to track buffer source mode and implement the method. Add near the existing `setSource`:

```typescript
let bufferSource: { data: Uint8Array; width: number; height: number } | null = null;

function setSourceFromBuffer(data: Uint8Array, width: number, height: number): void {
  bufferSource = { data, width, height };
  source = null;
}
```

**Step 3: Update renderFrame to handle buffer source**

At the top of `renderFrame()`, where the source is copied to the GPU texture (the `copyExternalImageToTexture` call), add a branch for buffer source:

```typescript
if (bufferSource) {
  device.queue.writeTexture(
    { texture: srcTex },
    bufferSource.data,
    { bytesPerRow: bufferSource.width * 4, rowsPerImage: bufferSource.height },
    { width: bufferSource.width, height: bufferSource.height },
  );
} else if (source) {
  device.queue.copyExternalImageToTexture(
    { source, flipY: false },
    { texture: srcTex },
    [srcTex.width, srcTex.height],
  );
} else {
  return;
}
```

**Step 4: Include setSourceFromBuffer in the returned object**

Add it to the return object alongside the existing methods:

```typescript
return {
  setSource(s: HTMLVideoElement | HTMLImageElement) { source = s; bufferSource = null; },
  setSourceFromBuffer,
  setParams(p: PreviewParams) { params = p; },
  renderFrame,
  destroy,
};
```

**Step 5: Build and verify**

Run: `bun run build:ui`

Expected: No build errors. Existing browser preview still works (setSource path unchanged).

**Step 6: Commit**

```bash
git add src/ui/app/gpu/renderer.ts
git commit -m "feat(renderer): add setSourceFromBuffer for headless frame input"
```

---

### Task 4: Create the render worker HTML page

Headless Chrome loads this page to run the GPU renderer.

**Files:**
- Create: `src/gpu/render-worker.html`

**Step 1: Create the worker page**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<canvas id="c"></canvas>
<script type="module">
import { createRenderer } from "../ui/app/gpu/renderer.js";

let renderer = null;
let canvas = document.getElementById("c");

window.__initRenderer = async function(width, height) {
  canvas.width = width;
  canvas.height = height;
  renderer = await createRenderer(canvas, { sourceWidth: width, sourceHeight: height });
  return true;
};

window.__renderFrame = function(rgbaArray, width, height, params) {
  renderer.setSourceFromBuffer(new Uint8Array(rgbaArray), width, height);
  renderer.setParams(params);
  renderer.renderFrame();
};

window.__readPixels = async function() {
  const gl = canvas.getContext("webgl2");
  if (gl) {
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels);
  }
  // Fallback: toBlob
  const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
  const buf = await blob.arrayBuffer();
  return Array.from(new Uint8Array(buf));
};

window.__destroy = function() {
  if (renderer) renderer.destroy();
  renderer = null;
};
</script>
</body>
</html>
```

Note: This is a starting point. The exact import path and pixel readback method will need adjustment during implementation — WebGPU canvases can't use `webgl2.readPixels`. The actual readback will likely use `canvas.toBlob()` or the WebGPU buffer copy approach. Adjust during implementation.

**Step 2: Commit**

```bash
git add src/gpu/render-worker.html
git commit -m "feat(gpu): add render worker HTML page for headless Chrome"
```

---

### Task 5: Create the headless renderer module

This module manages the headless Chrome instance and provides a frame rendering API.

**Files:**
- Create: `src/gpu/headless-renderer.ts`
- Test: `src/__tests__/gpu/headless-renderer.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createHeadlessRenderer, type HeadlessRenderer } from "../../gpu/headless-renderer";

describe("HeadlessRenderer", () => {
  let renderer: HeadlessRenderer;

  beforeAll(async () => {
    renderer = await createHeadlessRenderer();
  }, 30000);

  afterAll(async () => {
    await renderer.close();
  });

  it("initializes with dimensions", async () => {
    await renderer.init(100, 100);
  });

  it("renders a frame from RGBA buffer", async () => {
    await renderer.init(2, 2);
    // 2x2 red image
    const rgba = new Uint8Array([
      255, 0, 0, 255,  255, 0, 0, 255,
      255, 0, 0, 255,  255, 0, 0, 255,
    ]);
    const result = await renderer.renderFrame(rgba, 2, 2, {});
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(2 * 2 * 4); // RGBA output
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/gpu/headless-renderer.test.ts`

Expected: FAIL — module doesn't exist

**Step 3: Implement the headless renderer**

Create `src/gpu/headless-renderer.ts`:

```typescript
import { chromium, type Browser, type Page } from "playwright";
import { join } from "node:path";

export interface HeadlessRenderer {
  init(width: number, height: number): Promise<void>;
  renderFrame(rgba: Uint8Array, width: number, height: number, params: Record<string, unknown>): Promise<Uint8Array>;
  close(): Promise<void>;
}

export async function createHeadlessRenderer(): Promise<HeadlessRenderer> {
  const browser = await chromium.launch({
    args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
  });
  const page = await browser.newPage();

  // Load the render worker page
  const workerPath = join(import.meta.dir, "render-worker.html");
  await page.goto(`file://${workerPath}`);

  async function init(width: number, height: number): Promise<void> {
    await page.evaluate(
      ([w, h]) => (window as any).__initRenderer(w, h),
      [width, height],
    );
  }

  async function renderFrame(
    rgba: Uint8Array,
    width: number,
    height: number,
    params: Record<string, unknown>,
  ): Promise<Uint8Array> {
    // Send frame data and params to the page, render, read back pixels
    const pixelArray = await page.evaluate(
      ([data, w, h, p]) => {
        (window as any).__renderFrame(data, w, h, p);
        return (window as any).__readPixels();
      },
      [Array.from(rgba), width, height, params],
    );
    return new Uint8Array(pixelArray);
  }

  async function close(): Promise<void> {
    await page.evaluate(() => (window as any).__destroy());
    await browser.close();
  }

  return { init, renderFrame, close };
}
```

Note: Passing large frame buffers via `page.evaluate` will be slow for large frames. This is acceptable for the headless Chrome approach — optimize in the wgpu sidecar later. If too slow, use CDP `Runtime.evaluate` with binary transfer or shared memory.

**Step 4: Run test**

Run: `bun test src/__tests__/gpu/headless-renderer.test.ts`

Expected: PASS (may need to adjust based on WebGPU availability in headless Chrome — if WebGPU isn't available, the test documents that and we adjust the Chrome flags).

**Step 5: Commit**

```bash
git add src/gpu/headless-renderer.ts src/__tests__/gpu/headless-renderer.test.ts src/gpu/render-worker.html
git commit -m "feat(gpu): headless Chrome renderer for server-side GPU rendering"
```

---

### Task 6: Rewrite video export pipeline

Replace the FFmpeg filter graph export with the headless GPU pipeline.

**Files:**
- Modify: `src/pipeline.ts`
- Modify: `src/ui/server.ts`

**Step 1: Create GPU video export function**

In `src/pipeline.ts`, add a new export function (keep the old one temporarily for reference):

```typescript
import { createHeadlessRenderer } from "./gpu/headless-renderer";

export async function runGpuExport(
  input: string,
  output: string,
  params: Record<string, unknown>,
  probeResult: ProbeResult,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const { width, height, fps, duration } = probeResult;
  if (!width || !height || !fps || !duration) {
    throw new Error("Video metadata incomplete — need width, height, fps, duration");
  }

  const totalFrames = Math.ceil(fps * duration);
  const frameSize = width * height * 4;

  // Spawn FFmpeg decoder: raw RGBA output to stdout
  const decoder = Bun.spawn([
    "ffmpeg", "-i", input,
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-v", "quiet",
    "pipe:1",
  ], { stdout: "pipe", stderr: "pipe" });

  // Spawn FFmpeg encoder: raw RGBA input from stdin, copy audio from original
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

  // Create headless renderer
  const renderer = await createHeadlessRenderer();
  await renderer.init(width, height);

  // Process frames
  const reader = decoder.stdout.getReader();
  let buffer = new Uint8Array(0);
  let frameCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Accumulate bytes until we have a full frame
      const combined = new Uint8Array(buffer.length + value.length);
      combined.set(buffer);
      combined.set(value, buffer.length);
      buffer = combined;

      while (buffer.length >= frameSize) {
        const frame = buffer.slice(0, frameSize);
        buffer = buffer.slice(frameSize);

        const rendered = await renderer.renderFrame(frame, width, height, params);
        encoder.stdin.write(rendered);

        frameCount++;
        onProgress(Math.min(frameCount / totalFrames, 1));
      }
    }

    encoder.stdin.end();
    const exitCode = await encoder.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(encoder.stderr).text();
      throw new Error(`FFmpeg encoder failed: ${stderr.trim()}`);
    }
    onProgress(1);
  } finally {
    await renderer.close();
  }
}
```

**Step 2: Update server export handler**

In `src/ui/server.ts`, update the `/api/export` handler to use `runGpuExport` for video and skip server export entirely for images (images are handled client-side now):

```typescript
// In the /api/export handler, replace the runPipelineWithProgress call:
if (probeResult.isImage) {
  return new Response("Image export is handled client-side", { status: 400 });
}

// Video export via GPU
const stream = new ReadableStream({
  async start(controller) {
    try {
      await runGpuExport(inputPath, outputPath, parsedParams, probeResult, (ratio) => {
        controller.enqueue(`data: ${JSON.stringify({ progress: ratio })}\n\n`);
      });
      controller.enqueue(`data: ${JSON.stringify({ done: true, downloadUrl: `/api/download?path=${outputPath}` })}\n\n`);
    } catch (err) {
      controller.enqueue(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    }
    controller.close();
  },
});
```

**Step 3: Test video export**

Run: `bun run build:ui && bun run src/cli.ts ui`

Test: Load a short video clip, apply effects, click Export. Verify:
- Progress bar advances
- Output video plays correctly
- Audio is intact
- Visual effects match the preview

**Step 4: Commit**

```bash
git add src/pipeline.ts src/ui/server.ts
git commit -m "feat(export): GPU-rendered video export via headless Chrome"
```

---

### Task 7: Delete FFmpeg filter modules

Now that GPU rendering handles all effects, remove the FFmpeg filter implementations.

**Files:**
- Delete: `src/effects/aberration.ts`
- Delete: `src/effects/bloom.ts`
- Delete: `src/effects/cameraShake.ts`
- Delete: `src/effects/colorSettings.ts`
- Delete: `src/effects/grade.ts`
- Delete: `src/effects/grain.ts`
- Delete: `src/effects/halation.ts`
- Delete: `src/effects/splitTone.ts`
- Delete: `src/effects/splitToneMath.ts`
- Delete: `src/effects/utils.ts`
- Delete: `src/effects/vignette.ts`
- Delete: `src/effects/weave.ts`
- Delete: related tests in `src/__tests__/effects/`
- Modify: `src/pipeline.ts` — remove `buildFilterGraph` and old `runPipelineWithProgress`
- Modify: `src/types.ts` — remove unused effect option types if no longer referenced

**Step 1: Delete effect modules and their tests**

```bash
rm -rf src/effects/
rm -rf src/__tests__/effects/
```

**Step 2: Clean up pipeline.ts**

Remove `buildFilterGraph()`, the old `runPipelineWithProgress()`, and all imports from `src/effects/`. Keep only `runGpuExport` and any shared utilities.

**Step 3: Clean up types.ts**

Remove effect option interfaces that are no longer imported anywhere (HalationOptions, BloomOptions, etc.). Keep `FilmOptions` if still used by presets, or refactor to use `PreviewParams` as the single source of truth.

**Step 4: Clean up CLI**

Update `src/cli.ts` to remove all the `--halation-*`, `--bloom-*`, etc. CLI flags that drove the FFmpeg filter graph. The CLI should either launch the UI or use the headless renderer directly.

**Step 5: Run tests**

Run: `bun test`

Expected: All remaining tests pass. Fix any broken imports.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove FFmpeg filter modules, single GPU rendering path"
```

---

### Task 8: Update CLI for headless GPU export

The CLI (`bun run src/cli.ts input.mp4`) should use the headless GPU renderer instead of FFmpeg filters.

**Files:**
- Modify: `src/cli.ts`

**Step 1: Update CLI to use GPU export**

Replace the FFmpeg filter graph path with `runGpuExport`. The CLI reads a preset file, converts it to params, probes the input, and calls the GPU export:

```typescript
// In main(), after parsing args:
const probeResult = await probe(options.input);

if (probeResult.isImage) {
  // For images: use headless renderer, write output directly
  const renderer = await createHeadlessRenderer();
  await renderer.init(probeResult.width!, probeResult.height!);
  // Read image as raw RGBA, render, write PNG
  // ... (use sharp or canvas to decode image to RGBA, then renderer.renderFrame)
  await renderer.close();
} else {
  // For video: use GPU export pipeline
  await runGpuExport(options.input, options.output, params, probeResult, (ratio) => {
    process.stdout.write(`\rProcessing... ${Math.round(ratio * 100)}%`);
  });
}
```

Note: Image CLI export requires decoding the source image to raw RGBA without a browser. Options: use FFmpeg to decode to rawvideo, or use a headless Chrome page to load the image (same as design section 2). Use the headless Chrome approach for consistency.

**Step 2: Test**

Run: `bun run src/cli.ts test_screen.png --preset default -o output.png`

Verify output matches web preview.

**Step 3: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): use headless GPU renderer for CLI export"
```

---

### Task 9: End-to-end parity tests

Verify pixel-perfect match between preview and export.

**Files:**
- Create: `src/__tests__/e2e/gpu-export.test.ts`

**Step 1: Write parity test**

```typescript
import { describe, it, expect } from "bun:test";
import { createHeadlessRenderer } from "../../gpu/headless-renderer";

describe("GPU export parity", () => {
  it("renders identical output for same input and params", async () => {
    const renderer = await createHeadlessRenderer();
    await renderer.init(100, 100);

    // Create a test frame (gradient)
    const rgba = new Uint8Array(100 * 100 * 4);
    for (let i = 0; i < 100 * 100; i++) {
      rgba[i * 4] = (i % 100) * 2.55;     // R gradient
      rgba[i * 4 + 1] = Math.floor(i / 100) * 2.55; // G gradient
      rgba[i * 4 + 2] = 128;               // B constant
      rgba[i * 4 + 3] = 255;               // A
    }

    const params = { "halation-amount": 0.3, "halation-radius": 10 };

    // Render twice with same input
    const result1 = await renderer.renderFrame(rgba, 100, 100, params);
    const result2 = await renderer.renderFrame(rgba, 100, 100, params);

    expect(result1).toEqual(result2); // Deterministic output

    await renderer.close();
  }, 30000);
});
```

**Step 2: Run test**

Run: `bun test src/__tests__/e2e/gpu-export.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/__tests__/e2e/gpu-export.test.ts
git commit -m "test(e2e): GPU export parity and determinism tests"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Client-side image export | None |
| 2 | Extend probe (width, height, fps) | None |
| 3 | Add writeTexture to renderer | None |
| 4 | Create render worker HTML | Task 3 |
| 5 | Create headless renderer module | Tasks 3, 4 |
| 6 | Rewrite video export pipeline | Tasks 2, 5 |
| 7 | Delete FFmpeg filter modules | Task 6 |
| 8 | Update CLI for headless export | Tasks 5, 7 |
| 9 | End-to-end parity tests | Task 5 |

Tasks 1, 2, 3 can be done in parallel. Tasks 4-5 follow after 3. Task 6 is the core integration. Tasks 7-9 are cleanup and validation.
