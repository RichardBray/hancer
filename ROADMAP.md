# Hancer Roadmap

## Architecture
- [x] Restructure into monorepo (packages/core, cli, ui, wgpu + apps/desktop)
- [x] Separate CLI and UI into independent Bun-compiled binaries
- [x] Set up Bun workspaces

## Web UI
- [ ] Revamp UI — Lightroom/Final Cut Pro hybrid design with Tailwind
- [ ] Left panel: adjustments/sliders
- [ ] Right panel: presets browser
- [ ] Video timeline editor
- [ ] Animated sliders — lerp values on preset switch or AI updates (~300ms transitions)
- [ ] WebGPU preset preview on hover (thumbnail-sized effect preview)
- [ ] WebGL LUT shader for log profile preview (V-Log, S-Log, C-Log)
- [ ] RAW photo support via server-side conversion
- [ ] Browser-based e2e tests (after UI revamp is complete)

## macOS Desktop App
- [ ] Electron shell wrapping CLI + UI binaries
- [ ] Tab support for multiple simultaneous projects
- [ ] `.hproject` file association and double-click-to-open
- [ ] `.hpreset` file association and import

## CLI
- [ ] JSON params interface for programmatic/AI use (`--params '{...}'`)
- [ ] Keep individual flags for human use
- [ ] First non-black frame extraction for video look matching

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
