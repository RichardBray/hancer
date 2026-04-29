# Hance Architecture

## Monorepo Structure

```
hance/
├── packages/
│   ├── core/          # Shared effect definitions, types, filter graph builder
│   ├── cli/           # CLI binary — video processing, FFmpeg orchestration
│   ├── ui/            # Web UI — Bun fullstack server + React browser client
│   └── wgpu/          # Rust wgpu renderer for headless export
├── apps/
│   └── desktop/       # Electron macOS app — orchestrates CLI and UI
├── presets/           # Built-in .hlook files
```

- `cli` and `ui` are separate Bun-compiled binaries
- Both depend on `core` via Bun workspaces; `cli` also depends on `ui` for the `ui` subcommand
- The desktop app launches both as needed

## Web UI

### Layout

FCP-inspired three-column layout built with React 19 and Tailwind CSS v4:

```
+------------------------------------------+
|  hance              filename.mp4  [Export]|  <- TopBar
+----------+----------------+--------------+
|          |                |              |
|  Looks   |    Canvas /    | Adjustments  |
|  Browser |    Video       | Inspector    |
|  (left)  |    Preview     | (right)      |
|          |                |              |
+----------+----------------+--------------+
|  >> 00:01:39  ━━━━●━━━━  03:44:23       |  <- Timeline (video only)
+------------------------------------------+
```

- **Left panel (LooksPanel)**: 2-column grid of look thumbnails. Click applies, hover previews on canvas. Right-click for rename/delete. Header has + (new look modal) and import buttons.
- **Center (Canvas)**: WebGPU-rendered preview with aspect-ratio preservation. Shows UploadZone drop zone when no media loaded.
- **Right panel (AdjustmentsPanel)**: Collapsible effect groups matching EFFECT_SCHEMA. FCP-style RangeSliders with label/track/value. SaveBar appears when values differ from loaded look.
- **Bottom (Timeline)**: Video only. Play/pause, timecodes, draggable playhead, spacebar toggle.
- All panel boundaries are resizable via ResizeDivider components with min/max constraints.

### Component Tree

```
App
├── TopBar (logo, filename, export/download)
├── LooksPanel
│   ├── LookCard (thumbnail + name)
│   ├── LookContextMenu (rename/delete)
│   ├── NewLookModal
│   └── DeleteLookModal
├── Canvas / UploadZone
├── AdjustmentsPanel
│   ├── SaveBar
│   └── EffectGroup (per schema group)
│       ├── RangeSlider
│       ├── Toggle
│       └── SelectControl
├── Timeline
└── ResizeDivider (between each panel)
```

### Hooks

- `useUpload` — file selection and object URL management
- `useLooks` — look CRUD operations (list, load, save, create, delete, rename, import) via server API
- `useResizable` — panel resize logic with clamped min/max

### Build

- CSS: PostCSS + Tailwind CSS v4 (`packages/ui/app/styles.css` → `dist/styles.css`)
- JS: Bun.build bundler (`packages/ui/app/index.tsx` → `dist/index.js`)
- Build script: `scripts/build-ui.ts` runs CSS then JS, injects both into `index.html`

### Server (`packages/ui/server.ts`)

Bun HTTP server serving both API endpoints and static SPA files from `dist/`.

**Endpoints:**
- `GET /api/schema` — effect schema for building the adjustments panel
- `GET /api/looks` — list available look names
- `GET /api/look?name=` — load look params (unwraps `.hlook` params key)
- `POST /api/looks` — create new look with metadata
- `PUT /api/look` — update existing look params
- `DELETE /api/look?name=` — delete a look
- `POST /api/look/rename` — rename a look
- `POST /api/look/import` — import .hlook file via multipart form
- `POST /api/export` — server-side video export via FFmpeg (SSE progress stream)
- `GET /api/download?path=` — download exported file

## Processing Pipelines

### Images — Browser Only
- All image processing happens client-side via WebGPU renderer
- Final image export is handled by the browser (canvas → PNG)

### Videos — CLI Only
- All video processing goes through the CLI and FFmpeg
- Frame extraction, look matching, and export are all CLI operations
- The web UI previews via WebGPU but exports via the server's FFmpeg pipeline

### Video Render Pipeline (`packages/cli/src/pipeline.ts`)

`runGpuExport` builds a single shell pipeline:

```
ffmpeg -i <input> -f rawvideo -pix_fmt rgba pipe:1
  | hance-wgpu '<init-json>'
  | ffmpeg -f rawvideo -pix_fmt rgba ... -i pipe:0 -i <input> \
           -map 0:v -map 1:a? -c:a copy -c:v <encoder> <output>
```

- **Stage 1 (decoder ffmpeg):** demux + decode to raw RGBA frames.
- **Stage 2 (wgpu sidecar):** runs the effect chain on the GPU. Init JSON carries `{ width, height, params }`. Effect order is fixed in the sidecar: `colorSettings → halation → aberration → bloom → grain → vignette → splitTone → cameraShake`.
- **Stage 3 (encoder ffmpeg):** re-encodes RGBA to the chosen codec; copies the original audio track from `<input>`. A `scale=in_range=full:out_range=tv` filter converts full-range RGB to limited-range BT.709 YUV so players don't display a washed-out image.

Progress is reported via FFmpeg's `-progress` file, polled every 100 ms by `parseProgress`.

For still images, `packages/cli/src/gpu/image-pipeline.ts` skips ffmpeg entirely and drives the wgpu sidecar directly.

### Encoder Selection

`detectEncoders` parses `ffmpeg -encoders` once and caches the result. On macOS the pipeline prefers VideoToolbox (`h264_videotoolbox` / `hevc_videotoolbox`) and falls back to `libx264` / `libx265`. ProRes always uses `prores_ks`. CRF values are mapped to VideoToolbox `q:v` via `crfToVideoToolboxQ`.

Export presets (`low` / `medium` / `high` / `max`) live in `packages/core/src/export-presets.ts` and resolve to `{ codec, crf, encodePreset, pixelFormat }`. CLI overrides (`--codec`, `--crf`, `--encode-preset`) win over preset values.

### Build

`bun run build` is a three-step compile:

1. `cargo build --release` — produces `packages/wgpu/target/release/hance-wgpu`.
2. `bun run scripts/build-ui.ts` — bundles the UI into `packages/ui/dist/`.
3. `bun build packages/cli/src/cli.ts --compile` — produces a single `hance` executable. The wgpu sidecar binary is located via `sidecarPath()`.

`HANCE_VERSION` is injected at compile time via `--define`. Cross-target builds use `BUN_TARGET`.

## Look Matcher

AI-powered feature that analyzes a reference image and matches its look to the user's footage or image.

### Flow
1. User provides a reference image (the "look" they want)
2. For videos: CLI extracts the first non-black frame
3. AI analyzes the reference image against a look index (two-stage lookup)
4. If a look matches: apply it, then fine-tune individual params
5. If no match: build params from scratch
6. Results applied differently depending on context:
   - **Web UI open:** sliders update with AI values → browser re-renders preview live
   - **CLI only:** params applied directly to video, no UI communication

### Two-Stage Look Lookup
1. **Index file** (`presets/index.json`) — one entry per look with name, keywords, and characteristics. Model scans this to shortlist candidates.
2. **Full read** — model loads full `.hlook` files only for shortlisted candidates.

The index file is plain JSON (machine-generated), rebuilt automatically on any look change (save, edit, delete, import). No LLM or scheduler needed — just a `core` function called at the point of change.

## Look Format

File extension: `.hlook` (JSON)

```json
{
  "name": "Cinematic Warm",
  "description": "Warm cinematic grade with lifted shadows",
  "keywords": ["warm", "cinematic", "film"],
  "characteristics": ["warm tones", "low contrast", "lifted blacks"],
  "params": {
    "exposure": 0.1,
    "contrast": 0.85,
    "fade": 0.15,
    "halation-amount": 0.3
  }
}
```

- Looks can be created manually (name + params only) or by an LLM (full metadata)
- The LLM is only needed to generate/enrich description, keywords, and characteristics
- Looks without metadata still work for applying effects, but won't appear in look matching results
- `loadPreset` in core supports both `.hlook` (params nested) and legacy `.json` (params at top level)

## Project Files

File extension: `.hproject` (JSON)

Used for saving full edit state, including per-section look assignments for video timelines. Separate concern from looks — looks are reusable atoms, projects are the full edit state.

## Communication

- The web UI drives the CLI as a subprocess for video operations
- When look matching with UI open: AI generates CLI params → UI updates sliders → browser re-renders preview
- CLI is fully self-sufficient for video workflows without the UI
