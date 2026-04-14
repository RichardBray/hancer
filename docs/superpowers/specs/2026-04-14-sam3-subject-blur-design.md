# SAM 3 Subject Blur — Design

**Date:** 2026-04-14
**Status:** Draft — pending implementation plan

## Summary

Add a new effect that keeps a video's foreground subject sharp while bokeh-blurring the background. Segmentation runs on Replicate using Meta's SAM 3.1; masks are cached per video so slider tweaks and re-renders are free after the first pass.

## Motivation

Hance ships cinematic film effects in a single FFmpeg pass. Shallow depth-of-field is one of the most recognizable "cinema" signals and is currently impossible without a real lens or a per-frame rotoscope. SAM 3.1 makes the mask step a few seconds of cloud inference, which brings this effect into Hance's reach.

## Scope

### In scope (v1)
- Replicate-hosted SAM 3.1 segmentation with user-supplied API token (BYOK)
- CLI flags for auto-salient, text prompt, and pre-computed mask inputs
- UI tab (separate from existing look controls) with click-to-select, live slider preview, and Export at full resolution
- Bokeh-style background blur on a binary mask with configurable amount, feather, and shape
- Content-addressed on-disk mask cache

### Out of scope (v1)
- Depth-based progressive falloff (planned v2 — see Future Work)
- Multi-subject selection
- Managed billing / Hance-provided inference
- Persistent project state (handled by upcoming `.hproj` PR)
- Serialization into `.hlook` files — subject blur is per-clip artistic intent, not a reusable style

## Architecture

A new effect module `subject-blur` sits alongside `grade`, `halation`, `aberration`, and `weave`. Unlike those effects, it cannot be computed from pixels alone — it consumes a per-frame PNG mask supplied as a second FFmpeg input.

```
packages/
  core/src/effects/subject-blur.ts       # pure fn: (inputLabel, opts, maskInputLabel) => FilterResult
  core/src/segmentation/
    replicate.ts                         # Replicate SAM 3.1 client
    mask-cache.ts                        # content-addressed cache
    proxy.ts                             # 720p proxy extraction for segmentation
    selector.ts                          # { mode: point|prompt|auto, value } + hashing
  cli/src/flags/subject-blur.ts          # flag parsing and validation
  ui/app/components/SubjectBlurTab.tsx   # separate inspector tab
  ui/app/components/SubjectPicker.tsx    # click-to-select overlay on preview
  ui/app/hooks/useSegmentation.ts        # kick off proxy segmentation, poll, cache
```

### Data flow (export)

1. **Resolve mask source** in priority order:
   1. `--subject-mask <path>` (CLI) or pre-existing full-res cache hit
   2. Cached mask for `(video-sha256, selector-hash)`
   3. Replicate call using selector (point, prompt, or auto-salient)
2. **Proxy extraction** (if needed): 720p H.264 of the source, cached at `~/.hance/cache/proxies/<sha>.mp4`
3. **Segmentation**: Replicate returns a PNG mask sequence; written to `~/.hance/cache/masks/<sha>/<selector-hash>/frame_%06d.png`
4. **FFmpeg graph** — two inputs (source video + mask PNG sequence), single pass:
   - Build two streams from source: `[sharp]` (untouched) and `[blurred]` (bokeh convolution)
   - Feather the mask with a gaussian before compositing
   - `overlay` sharp over blurred using the feathered mask as alpha
5. Effect chain order: `grade → halation → aberration → weave → subject-blur` (compositing happens last so the look applies to both layers uniformly)

### Mask caching

```
~/.hance/cache/
  proxies/<video-sha256>.mp4
  masks/<video-sha256>/<selector-hash>/
    meta.json                    # { selector, resolution, frames, createdAt }
    frame_000001.png ... frame_NNNNNN.png
```

- `video-sha256` — content hash of the source file
- `selector-hash` — `sha256(JSON({ mode, value, resolution }))`
- Proxy-resolution and full-resolution masks live under distinct `selector-hash` directories so the UI preview cache doesn't collide with the export cache
- LRU eviction by `atime`, default cap 10 GB, configurable via `~/.hance/config.json`
- `hance cache clear` command

## UI workflow

**Inspector tab layout:** a new tab icon in the top-of-inspector tab bar (FCP-style), parallel to the existing look controls tab. Selecting it reveals the Subject Blur panel. Existing look controls are untouched.

**State machine (per clip, in-memory for v1):**
```
no-subject → picking → segmenting-proxy → ready → segmenting-export (on Export)
                ↑                           │
                └────────── re-pick ────────┘
```

**Interaction:**
1. "Pick subject" button → preview pauses, cursor becomes crosshair
2. User clicks a point on the frame → hook sends `(video-sha, frame-index, x, y)` to segmentation service
3. Proxy extraction runs (cached), then Replicate call
4. Progress indicator shows frames completed
5. On completion, sliders unlock: **Amount** (0–100), **Feather** (0–100), **Shape** (circle / hex / anamorphic)
6. Scrubbing timeline shows live preview using proxy-res mask upscaled with bicubic
7. **Export** triggers full-res segmentation (if not already cached), then normal render

**Cost transparency:** before kicking off segmentation, show estimated cost (duration × Replicate per-second rate) with a one-time per-project "Don't show again" option.

**Error states:**
- Missing API token → inline banner with link to Replicate token settings
- Network failure mid-segmentation → keep partial masks, offer "Resume"
- Click landed on unsegmentable region → "Try another point"
- Mask frame count ≠ video frame count → hard error, do not render

**Undo/redo:** subject selection and slider changes route through existing `useHistory` hook.

**Persistence:** v1 is in-memory only. Subject-blur state (selector, amount, feather, shape, mask cache reference) will be serialized into `.hproj` in a separate PR. Release notes must call out reload-loses-work until then.

## CLI

Auto-salient is the CLI default (matches batch/scripted use):

```
hance input.mp4 \
  --subject-blur 60 \
  --feather 20 \
  --shape hex \
  -o out.mp4
```

| Flag | Purpose | Default |
|------|---------|---------|
| `--subject-blur <0-100>` | Enable and set blur amount | off |
| `--feather <0-100>` | Mask edge softness | 20 |
| `--shape <circle\|hex\|anamorphic>` | Bokeh kernel shape | circle |
| `--subject-prompt "<text>"` | Override auto-salient with SAM 3 text prompt | — |
| `--subject-mask <path>` | Skip Replicate; use supplied PNG sequence or video | — |

Requires `REPLICATE_API_TOKEN` env var **unless** `--subject-mask` is supplied. Missing token fails with an actionable message modeled on the GPU sidecar error pattern (commit `7b3bb31`).

## Bokeh rendering

Background blur uses a custom convolution kernel applied before compositing. Kernel shapes:

- **circle** — disc kernel, radius derived from `amount`
- **hex** — hexagonal kernel (two overlapping rotated rectangles approximation)
- **anamorphic** — vertically-stretched oval (aspect ~1.8:1)

Feather step: gaussian blur applied to the binary mask before using it as an alpha, radius proportional to `feather`. This prevents the "cutout" look.

## Authentication

BYOK (bring your own key). User stores `REPLICATE_API_TOKEN` in env or, in the UI, in a settings screen that writes to OS keychain. No Hance-operated billing in v1.

## Testing

- **Unit** — `subject-blur` effect module: fixture mask + opts → asserted filter graph string
- **Unit** — `mask-cache`: selector hashing stability, LRU eviction, content-addressed collisions
- **Unit** — `selector`: hash stability across platforms and JSON key ordering
- **Integration** — mocked Replicate client returning canned PNG sequence → end-to-end CLI run produces correct FFmpeg invocation
- **E2E** — `--subject-mask` path only (no network required in CI): 10-frame fixture video + hand-crafted mask sequence → real FFmpeg → pixel-spot-check on output

## Future work (v2)

- **Depth-based falloff** — add Depth Anything V2 pass on Replicate; blend blur radius by depth so distant background blurs more than near background. Progressive DoF that reads as real optics rather than flat background blur.
- **Multi-subject support** — segment two or more subjects with different sharpness zones
- **Mask refinement tools** — stroke-based corrections on the proxy mask before committing to full-res
- **Managed inference** — Hance-provided billing for users who don't want to manage Replicate accounts

## Open questions

None remaining for v1. Depth model choice (Depth Anything V2 vs. Marigold) will be reopened when v2 is scoped.
