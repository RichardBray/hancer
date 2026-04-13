# Hance Roadmap

## Architecture
- [x] Restructure into monorepo (packages/core, cli, ui, wgpu + apps/desktop)
- [x] Separate CLI and UI into independent Bun-compiled binaries
- [x] Set up Bun workspaces
- [ ] Delete `docs/superpowers/` planning documents

## Web UI
- [ ] Revamp UI — Lightroom/Final Cut Pro hybrid design with Tailwind
- [ ] Left panel: adjustments/sliders
- [ ] Right panel: presets browser
- [ ] Video timeline editor
- [ ] Animated sliders — lerp values on preset switch or AI updates (~300ms transitions)
- [ ] WebGPU preset preview on hover (thumbnail-sized effect preview)
- [ ] WebGL LUT shader for log profile preview (V-Log, S-Log, C-Log)
- [ ] RAW photo support via server-side conversion
- [ ] Investigate `copyExternalImageToTexture` for video — currently uses 2D canvas intermediary (CPU round-trip per frame) because the direct WebGPU path silently returns empty pixels; try `VideoFrame` API or alternate texture formats
- [ ] Browser-based e2e tests (after UI revamp is complete)
- [ ] Prevent stale UI bundle: rebuild on `ui` server startup + stale-dist warning (mtime check of `app/**` vs `dist/index.js`)

## macOS Desktop App
- [ ] Electron shell wrapping CLI + UI binaries
- [ ] Tab support for multiple simultaneous projects
- [ ] `.hproject` file association and double-click-to-open
- [ ] `.hpreset` file association and import

## CLI
- [ ] JSON params interface for programmatic/AI use (`--params '{...}'`)
- [ ] Keep individual flags for human use
- [ ] First non-black frame extraction for video look matching
- [ ] Hardware video encoding: runtime-detect available encoders via `ffmpeg -encoders` and pick best (macOS: VideoToolbox; Win/Linux: NVENC → QSV → AMF → VAAPI → libx264 fallback). Add `--software` flag to force libx264/libx265. Map `--crf` to each encoder's native quality knob. Motivation: libx264 software encoding pegs CPU and runs the fan; VideoToolbox uses the dedicated media engine and stays cool.

## Color Grading
**MVP order:** 1 → 2 → 3. Ship LUT import first (highest leverage, least work), then curves (most powerful single in-app tool), then HSL (targeted tweaks). Export and color wheels come after.

- [ ] **[MVP 1]** `.cube` LUT import — parse 3D LUT file, upload as `texture_3d<f32>`, sample with trilinear filtering in final grade pass. Add LUT node at end of color chain (display-referred Rec.709/sRGB). UI: file picker + intensity slider (mix between original and LUT output). ~1 week of work, instantly unlocks the entire universe of existing LUT packs.
- [ ] **[MVP 2]** RGB / luma curves — tone curve editor, the most LUT-equivalent single in-app tool. Covers ~80% of "tweak colors" requests with one UI.
- [ ] **[MVP 3]** HSL qualifiers — hue/sat/lum shift across 6–8 color ranges (reds, oranges, yellows, greens, cyans, blues, magentas). Core targeted tweak tool (skin tones, skies, foliage).
- [ ] LUT export — bake current grade by running pipeline on an identity 3D texture, read back, write `.cube`. Post-MVP: only valuable once curves + HSL exist to build looks worth exporting.
- [ ] Lift / Gamma / Gain color wheels — per-tonal-range color control (shadows/mids/highlights). Post-MVP pro feature; curves already cover the common cases.
- [ ] Color space support — currently Rec.709 only. MVP stays Rec.709/sRGB display-referred (covers the vast majority of free LUT packs). Log profile input (S-Log3, V-Log, C-Log3, LogC) is a larger follow-up requiring input 1D shaper transforms — track separately with the existing "WebGL LUT shader for log profile preview" task.

## Look Matcher
- [ ] AI-powered reference image matching
- [ ] Two-stage preset lookup (index scan → full read of candidates)
- [ ] Auto-generate preset index on any preset change
- [ ] LLM-powered preset authoring and metadata enrichment
- [ ] When UI open: update sliders + live preview; CLI-only: apply directly

## Presets
- [ ] `.hpreset` format (JSON) with name, description, keywords, characteristics, params
- [ ] Preset index file (`presets/index.json`) — auto-rebuilt on change
- [ ] User-created presets (manual name + params, optional LLM enrichment)
- [ ] AI-generated presets with full metadata

## Project Files
- [ ] `.hproject` format for full edit state
- [ ] Per-section preset assignments for video timelines
