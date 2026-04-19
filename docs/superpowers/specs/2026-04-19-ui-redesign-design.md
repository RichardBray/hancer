# Hance UI Redesign — Design Spec

**Date:** 2026-04-19
**Scope:** Nine coordinated changes to the Hance UI covering layout, sliders, timeline, modals, and a new Export modal.

## Goals

- Remove visual noise and the "web app" feel — move toward a pro-tool aesthetic (DaVinci/FCP/NeuralFilmAI).
- Eliminate layout shifts caused by dynamic save controls.
- Surface file context (filename) in the top bar; demote app branding.
- Introduce a proper Export modal with codec, quality, and output path controls.

## Changes

### 1. Top Bar (`packages/ui/app/components/TopBar.tsx`)

- Remove the "Hance" wordmark from the left.
- **Left:** current filename of the loaded file. Empty when no file is loaded (no fallback branding).
- **Center:** empty.
- **Right cluster:** `Save` · `Save As New` · `Export` grouped together (see §2 for Save behavior, §6 for Export).

### 2. Save Bar (`packages/ui/app/components/SaveBar.tsx`)

- Move `Save` and `Save As New` out of the adjustments panel and into the top bar right cluster (§1).
- Remove the existing `SaveBar` row from `AdjustmentsPanel.tsx`. The adjustments title row reclaims the vertical space.
- **Always visible. No layout shift ever.**
- States:
  - **Clean (no unsaved changes):** `Save` button shows `Saved ✓` label, enabled but click is a no-op (tooltip: "No changes to save"). `Save As New` always enabled.
  - **Dirty:** `Save` shows `Save` label with primary styling.
- Dirty detection uses the existing change-tracking signal that currently drives `SaveBar`.

### 3. Sliders (`packages/ui/app/components/RangeSlider.tsx`)

Restyle from blue-filled track to a thin-line aesthetic:

- Track: 1px hairline, color `rgba(255,255,255,0.15)`, full width.
- **No filled portion** — track is one continuous color (drops blue entirely).
- Thumb: ~10px circle, light gray fill (`rgba(255,255,255,0.6)`), no border.
- Vertical rhythm: increase spacing between consecutive sliders to ~28–32px for "wide line-height" feel.
- Label (left) and value (right) styling preserved.

### 4. Border Radius & Padding (global, via `packages/ui/app/styles.css`)

Introduce CSS variables as single source of truth:

```
--radius-sm: 4px;   /* buttons, context menus, inputs */
--radius-md: 6px;   /* modals */
--pad-modal: 24px;
--pad-field-gap: 20px;
--pad-btn: 8px 16px;
--pad-btn-primary: 10px 20px;
--pad-menu-item: 8px 16px;
```

Apply to:

- **Buttons:** `--radius-sm`, `--pad-btn` (or `--pad-btn-primary` for modal primary actions).
- **Modals** (`NewLookModal`, `DeleteLookModal`, `LookInfoModal`, new `ExportModal`): `--radius-md`, inner `--pad-modal`, fields spaced by `--pad-field-gap`.
- **Context menu** (`LookContextMenu`): `--radius-sm`, item padding `--pad-menu-item`, outer padding `6px 0`.
- **Inputs:** `--radius-sm`.

### 5. Timeline (`packages/ui/app/components/Timeline.tsx`)

**Transport row (top of timeline):**

- Left: Play/Pause button.
- Center: Current timecode `HH:MM:SS:FF`, large and prominent.
- Timecode container background matches slider track tint (`rgba(255,255,255,0.15)` on a dark gray container) so the timer blends into panel chrome instead of appearing highlighted.

**Ruler (below scrubber):**

- Adaptive tick density: compute tick interval so ~6–10 major labels are visible for the current clip duration.
- Major ticks: labeled timecode; minor ticks: unlabeled, 4 between majors.
- Rendered as a thin strip beneath the existing scrubber track.

### 6. Export Modal (new: `packages/ui/app/components/ExportModal.tsx`)

Triggered by the existing `Export` button in the top bar cluster.

**Fields:**

- **Codec** (dropdown): `H.264 (mp4)` · `H.265/HEVC (mp4)` · `ProRes 422 (mov)`.
- **Quality (CRF)** (dropdown): `Visually Lossless` (17) · `High` (20) · `Medium` (23, default) · `Low` (28). Labels shown to user; numeric CRF passed to encoder. ProRes ignores CRF; field is disabled when ProRes is selected.
- **Output path**: read-only text field + `Choose…` button opening native file picker. Default filename: `<input-basename>_hance.<ext>` where extension tracks codec selection.

**Footer:** `Cancel` (secondary) · `Export` (primary).

Wires into the existing CLI/FFmpeg export path via new params (`codec`, `crf`, `outputPath`).

### 7. Info Modal (`packages/ui/app/components/LookInfoModal.tsx`)

Expand to show all saved look metadata. Fields are hidden entirely when empty (no "—" placeholders):

- **Name** — heading.
- **Description** — paragraph text.
- **Keywords** — pill chips.
- **Characteristics** — pill chips.
- Single `Close` button. Uses new radius/padding scale (§4).

### 8. View Mode Switcher (new: `packages/ui/app/components/ViewModeToolbar.tsx`)

A floating, horizontally-centered icon strip positioned just below the top bar, overlaid above the canvas region. Three mutually-exclusive modes:

- **Normal** (rectangle icon) — default. Processed canvas only. Current behavior.
- **Before/After Split** (split-rectangle icon) — vertical divider on the canvas. Left = original upload, right = processed. Drag the divider handle to wipe horizontally. Divider position is session-state (not persisted).
- **Reference Compare** (split-rectangle-with-upload icon) — prompts the user to upload a reference image if none chosen yet (small upload affordance inside the canvas region). Left = processed canvas, right = user reference, split by vertical wipe divider. Reference is scaled to **fit canvas bounds** with letterboxing if aspect differs. Reference image is held in session state only; cleared when switching files or closing the app. A small "Replace reference" / "Clear" affordance appears when a reference is loaded.

**Styling:**

- Strip is semi-transparent dark, uses new `--radius-sm`, padding `6px 8px`.
- Icons monochrome gray, ~18px, active mode gets higher-contrast fill.
- Only one mode active at a time; clicking the active icon is a no-op.

**Interaction:**

- Divider handle: vertical line with a small grab affordance at vertical center. Drag anywhere on the divider to move it. Keyboard: no shortcut in v1.
- Modes 2 and 3 require both images to be present; if the source upload is missing, the icon is disabled.

## Affected Files

- `packages/ui/app/components/TopBar.tsx` — restructure, integrate save/export.
- `packages/ui/app/components/SaveBar.tsx` — relocate + state logic.
- `packages/ui/app/components/AdjustmentsPanel.tsx` — remove save row.
- `packages/ui/app/components/RangeSlider.tsx` — restyle.
- `packages/ui/app/components/Timeline.tsx` — transport row + ruler.
- `packages/ui/app/components/LookContextMenu.tsx` — radius/padding.
- `packages/ui/app/components/NewLookModal.tsx`, `DeleteLookModal.tsx`, `LookInfoModal.tsx` — radius/padding + Info expansion.
- `packages/ui/app/components/ExportModal.tsx` — new.
- `packages/ui/app/components/ViewModeToolbar.tsx` — new.
- `packages/ui/app/components/Canvas.tsx` — split-compare rendering for modes 2 and 3.
- `packages/ui/app/styles.css` — CSS variables for radius/padding.

## Testing

- Unit: extend `packages/ui/__tests__/timeline.test.ts` for adaptive tick computation.
- Unit: new test for `ExportModal` form state (codec switching disables CRF for ProRes).
- Unit: `SaveBar` clean/dirty state rendering.
- Manual via `agent-browser --auto-connect` (per `packages/ui/__tests__/CLAUDE.md`) for visual verification: sliders, radius, timeline ruler, modals.

## Out of Scope

- No changes to the FFmpeg filter graph, effect math, or export pipeline logic beyond wiring new params through.
- No changes to the Looks data model or persistence — Info modal reads existing fields.
- No dark/light theme toggle.
