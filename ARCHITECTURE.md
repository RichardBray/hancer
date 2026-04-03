# Hancer Architecture

## Monorepo Structure

```
hancer/
├── packages/
│   ├── core/          # Shared effect definitions, types, filter graph builder
│   ├── cli/           # CLI binary — video processing, FFmpeg orchestration
│   ├── ui/            # Web UI binary — Bun fullstack server + browser client
│   └── wgpu/          # Rust wgpu renderer for headless export
├── apps/
│   └── desktop/       # Electron macOS app — orchestrates CLI and UI
```

- `cli` and `ui` are separate Bun-compiled binaries
- Both depend on `core` via Bun workspaces
- The desktop app launches both as needed

## Processing Pipelines

### Images — Browser Only
- All image processing happens client-side (Canvas/WebGL)
- RAW photos (CR3, ARW, NEF, etc.) are converted server-side by the Bun backend before reaching the browser
- Final image export is handled by the browser (canvas → PNG/JPEG)

### Videos — CLI Only
- All video processing goes through the CLI and FFmpeg
- Frame extraction, look matching, and export are all CLI operations
- Log profiles (V-Log, S-Log, C-Log) are rendered in the browser via WebGL LUT shaders for preview, but final processing uses the CLI

## Look Matcher

AI-powered feature that analyzes a reference image and matches its look to the user's footage or image.

### Flow
1. User provides a reference image (the "look" they want)
2. For videos: CLI extracts the first non-black frame
3. AI analyzes the reference image against a preset index (two-stage lookup)
4. If a preset matches: apply it, then fine-tune individual params
5. If no match: build params from scratch
6. Results applied differently depending on context:
   - **Web UI open:** sliders update with AI values → browser re-renders preview live
   - **CLI only:** params applied directly to video, no UI communication

### Two-Stage Preset Lookup
1. **Index file** (`presets/index.json`) — one entry per preset with name, keywords, and characteristics. Model scans this to shortlist candidates.
2. **Full read** — model loads full `.hpreset` files only for shortlisted candidates.

The index file is plain JSON (machine-generated), rebuilt automatically on any preset change (save, edit, delete, import). No LLM or scheduler needed — just a `core` function called at the point of change.

## Preset Format

File extension: `.hpreset` (JSON)

```json
{
  "name": "Golden Hour",
  "description": "Warm golden hour with soft diffused highlights and teal shadow tones",
  "keywords": ["warm", "golden-hour", "teal-shadows", "soft"],
  "characteristics": {
    "shadows": "cool/teal",
    "highlights": "warm/amber",
    "contrast": "low",
    "saturation": "moderate",
    "grain": "fine"
  },
  "params": {
    "grade": { "lift": [0.02, 0.01, -0.03], "gamma": [1.0, 0.98, 0.95] },
    "halation": { "strength": 0.4 },
    "aberration": { "shift": 2 }
  }
}
```

- Presets can be created manually (name + params only) or by an LLM (full metadata)
- The LLM is only needed to generate/enrich description, keywords, and characteristics
- Presets without metadata still work for applying effects, but won't appear in look matching results

## Project Files

File extension: `.hproject` (JSON)

Used for saving full edit state, including per-section preset assignments for video timelines. Separate concern from presets — presets are reusable atoms, projects are the full edit state.

## Communication

- The web UI drives the CLI as a subprocess for video operations
- When look matching with UI open: AI generates CLI params → UI updates sliders → browser re-renders preview
- CLI is fully self-sufficient for video workflows without the UI
