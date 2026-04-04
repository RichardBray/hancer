# UI Revamp Design Spec

## Overview

Full rewrite of the hancer web UI from inline-styled React components to a Tailwind-based, FCP-inspired three-column layout with resizable panels. Renames "Preset" to "Look" throughout (`.hlook` file format). Server and WebGPU renderer stay as-is; this is purely the React component layer plus new server endpoints for look thumbnails.

## Layout Structure

```
+------------------------------------------+
|  hancer              filename.mp4  [Export]|  <- Top bar
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

- **Top bar**: "hancer" text (left), filename (center), export button (right). No logo yet.
- **Left panel**: Looks browser. Default 240px, resizable 200-400px.
- **Center**: WebGPU canvas with aspect-ratio preservation. Upload drop zone when no media loaded.
- **Right panel**: Adjustments inspector. Default 300px, resizable 250-450px.
- **Bottom timeline**: Video only. Default 60px, resizable 50-200px. Play/pause, timecodes, scrub bar.

### Resizable Panels

Each panel boundary has a thin draggable divider:
- Left/right dividers: `cursor: col-resize`
- Bottom divider: `cursor: row-resize`
- Divider styling: `zinc-700` border, subtle highlight on hover/drag
- Constraints enforced via min/max pixel values

## Theme & Styling

- **Framework**: Tailwind CSS (proper install with `tailwind.config.ts` and PostCSS)
- **No inline styles** — all styling via Tailwind utility classes
- **Dark theme**: `zinc-900` base, `zinc-800` panels, `zinc-700` borders/tracks
- **Accent**: Blue for active controls, selected states, slider fills
- **Typography**: System font stack, small sizes (text-xs / text-sm) matching FCP density
- **FCP-inspired controls**: Clean label-left / control-right layout, subtle and professional

## Left Panel: Looks Browser

### Header
- "Looks" title
- "+" button — opens New Look modal
- Import button (upload icon) — file picker for `.hlook` JSON files

### Look Grid
- 2-column scrollable grid of square thumbnails
- Each card: square preview image + look name below
- Preview images generated server-side (bundled reference image + FFmpeg + look params, cropped to square, cached on disk)

### Look Card Interactions
- **Hover**: Subtle border highlight. Temporarily applies the look's effect to the canvas via WebGPU renderer. Does NOT change slider values. Reverts on mouse-out (~100ms debounce).
- **Click**: Loads look values into the right panel sliders with 300ms animated transition. Updates canvas. Marks this look as the active/selected look.
- **Selected state**: Blue accent border.
- **Right-click context menu**:
  - "Rename" — inline editable text field on the look name
  - "Delete" — opens confirmation modal

### New Look Modal
- Name (required)
- Description (text area)
- Keywords (comma-separated tags)
- Characteristics (e.g. "warm", "cinematic", "desaturated")
- Current slider values captured automatically
- "Create" / "Cancel" buttons

### Import Look
- Accepts `.hlook` (JSON) files
- Validates file structure, copies to user looks directory
- Thumbnail generated on import
- Toast notification on success/error

### Delete Confirmation Modal
- "Delete [look name]? This cannot be undone."
- "Delete" button (red) / "Cancel" button

## Right Panel: Adjustments Inspector

### Header
- "Adjustments" title

### Save Controls Bar
Visible when current slider values differ from the loaded look:
- "Save" button — overwrites current look with new values (no modal, metadata already exists)
- "Save As New" button — opens New Look modal pre-filled with current values

### Effect Groups
Collapsible sections matching the existing `EFFECT_SCHEMA` groups (Color Settings, Halation, Chromatic Aberration, Bloom, Grain, Vignette, Split Tone, Camera Shake).

Each group:
- **Header row**: Disclosure triangle (collapsed/expanded) + group label + enable/disable toggle (right-aligned)
- **Collapsed**: Header row only
- **Expanded**: List of controls

### Control Types

**Range sliders** (FCP-style):
- Label on the left
- Slider track in the middle: dark track (`zinc-700`), blue fill for active portion, small round thumb
- Numeric value on the right, click-to-edit for precise input

**Boolean toggles**:
- Label on the left
- Checkbox on the right (blue when checked)

**Select dropdowns**:
- Label on the left
- Styled dropdown on the right with chevron

### Slider Animation
- `transition: all 300ms ease-out` on slider fill width and thumb position
- When a look is clicked, values update via React state; CSS transitions handle visual interpolation
- WebGPU renderer receives interpolated values via `requestAnimationFrame` for smooth canvas preview

### Disabled State
- When an effect group is toggled off: controls appear at `opacity-40`, non-interactive

## Bottom: Video Timeline

Only rendered when loaded media is a video file.

### Layout (left to right)
- Play/pause button (triangle / double bar)
- Current timecode (`HH:MM:SS`)
- Scrub bar — full-width track, draggable thumb, click-to-seek
- Total duration (`HH:MM:SS`)

### Behavior
- Click anywhere on scrub bar to seek
- Drag thumb to scrub
- Spacebar toggles play/pause
- Timecode updates in real-time during playback

### Styling
- `zinc-800` background, subtle top border
- Scrub track: `zinc-700` background, `zinc-500` elapsed portion

## Upload State

When no media is loaded, the center area shows a drop zone:
- Dashed border, centered "+" icon and "Drop image or video here" text
- Click to open file picker
- Accepts `image/*` and `video/*`

## Server Additions

### Look Thumbnail Endpoint
`GET /api/look-thumbnail?name=<look>`

- Applies the look's params to a bundled square reference image via FFmpeg
- Returns JPEG
- Cached on disk (regenerated when look is updated)
- Reference image: bundled at `packages/ui/assets/reference.jpg`, center-cropped to square

### Renamed Endpoints
- `/api/presets` -> `/api/looks`
- `/api/preset` -> `/api/look`
- `.hpreset` -> `.hlook`

## File Format: `.hlook`

```json
{
  "name": "Cinematic Warm",
  "description": "Warm cinematic grade with lifted shadows",
  "keywords": ["warm", "cinematic", "film"],
  "characteristics": ["warm tones", "low contrast", "lifted blacks"],
  "params": {
    "exposure": 0.1,
    "contrast": 0.85,
    "fade": 0.15
  }
}
```

## Components (New)

All existing components are rewritten. New component tree:

- `App.tsx` — root layout, panel state, media state
- `TopBar.tsx` — logo, filename, export
- `LooksPanel.tsx` — left panel container
- `LookCard.tsx` — individual look thumbnail card
- `LookContextMenu.tsx` — right-click menu
- `NewLookModal.tsx` — create/save-as modal
- `DeleteLookModal.tsx` — confirmation dialog
- `Canvas.tsx` — center area, WebGPU canvas (replaces VideoPlayer)
- `UploadZone.tsx` — drop zone when no media (replaces UploadPanel)
- `AdjustmentsPanel.tsx` — right panel container (replaces ControlsPanel)
- `EffectGroup.tsx` — collapsible effect section
- `RangeSlider.tsx` — FCP-style slider
- `Toggle.tsx` — boolean control
- `SelectControl.tsx` — dropdown control
- `SaveBar.tsx` — save/save-as-new controls
- `Timeline.tsx` — bottom video timeline
- `ResizeDivider.tsx` — draggable panel divider

## What Does NOT Change

- `server.ts` — API structure stays the same (endpoints renamed)
- `gpu/renderer.ts` — WebGPU renderer untouched
- `gpu/passes.ts`, `gpu/shaders.ts`, `gpu/splitToneMath.ts` — untouched
- `hooks/useUpload.ts` — stays as-is
- `mediaSizing.ts` — stays as-is
- `@hancer/core` — no changes
- `@hancer/cli` — no changes

## Dependencies Added

- `tailwindcss` (+ PostCSS, autoprefixer)
- No other new dependencies
