# Hance UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 8-section UI redesign (spec: `docs/superpowers/specs/2026-04-19-ui-redesign-design.md`) — top bar restructure, save bar relocation, slider restyle, radius/padding scale, timeline transport+ruler, info modal expansion, export modal, view mode switcher with split-compare canvas.

**Architecture:** Changes are scoped to `packages/ui/app`. A new CSS-variable scale centralizes radius/padding. Split-compare uses CSS `clip-path` overlay rather than touching the WebGPU renderer — simpler and keeps the GPU path unchanged. Export modal replaces the inline Export button flow in `TopBar`.

**Tech Stack:** React + TypeScript + Tailwind CSS + bun:test, WebGPU preview renderer, Bun-served backend.

**Verification notes:** Logic-heavy work (adaptive ticks, save-bar state, export form) is TDD. Pure CSS/markup restyles are verified manually via `agent-browser --auto-connect` per `packages/ui/__tests__/CLAUDE.md`.

---

## Task 1: Design tokens (CSS variables)

**Files:**
- Modify: `packages/ui/app/styles.css`

- [ ] **Step 1: Add variables**

Open `packages/ui/app/styles.css`. In the `@layer base` or top-level `:root` (create if missing), append:

```css
:root {
  --radius-sm: 4px;
  --radius-md: 6px;
  --pad-modal: 24px;
  --pad-field-gap: 20px;
  --pad-btn: 8px 16px;
  --pad-btn-primary: 10px 20px;
  --pad-menu-item: 8px 16px;

  --slider-track: rgba(255,255,255,0.15);
  --slider-thumb: rgba(255,255,255,0.6);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/app/styles.css
git commit -m "feat(ui): add radius/padding/slider CSS tokens"
```

---

## Task 2: Restyle RangeSlider (thin line, no blue fill)

**Files:**
- Modify: `packages/ui/app/components/RangeSlider.tsx`

- [ ] **Step 1: Replace track + thumb + fill markup**

Replace the `return` block (lines 40–88) with:

```tsx
  return (
    <div className={`flex items-center gap-3 text-xs py-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <span className="text-zinc-400 w-28 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 relative h-4 flex items-center">
        <div
          className="absolute inset-x-0"
          style={{ height: "1px", background: "var(--slider-track)" }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          onPointerUp={() => onCommit?.()}
          onKeyUp={e => {
            const k = e.key;
            if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown" || k === "PageUp" || k === "PageDown" || k === "Home" || k === "End") onCommit?.();
          }}
          className={`absolute inset-0 w-full opacity-0 cursor-pointer ${animating ? "animating" : ""}`}
        />
        <div
          className={`absolute w-2.5 h-2.5 rounded-full pointer-events-none ${animating ? "transition-all duration-300 ease-out" : ""}`}
          style={{
            left: `calc(${fillPercent}% - 5px)`,
            background: "var(--slider-thumb)",
          }}
        />
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
          className="w-14 text-right bg-zinc-800 border border-zinc-600 rounded-sm px-1 py-0.5 text-zinc-200 text-xs tabular-nums"
        />
      ) : (
        <span
          onClick={startEdit}
          className="w-14 text-right text-zinc-500 tabular-nums cursor-text hover:text-zinc-300"
        >
          {value}
        </span>
      )}
    </div>
  );
```

Key changes: removed blue `bg-accent` fill div, track is now 1px hairline from `--slider-track`, thumb uses `--slider-thumb`, outer wrapper gets `py-2` for wider vertical rhythm.

- [ ] **Step 2: Manual verify**

Run `bun run dev` (from repo root), open the UI, load a file, open Adjustments — sliders show as hairline with gray thumb, no blue fill, extra vertical spacing between sliders.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/app/components/RangeSlider.tsx
git commit -m "feat(ui): restyle sliders as thin-line (drop blue fill)"
```

---

## Task 3: SaveBar clean/dirty states (logic)

**Files:**
- Modify: `packages/ui/app/components/SaveBar.tsx`
- Create: `packages/ui/__tests__/SaveBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/__tests__/SaveBar.test.tsx`:

```tsx
import { test, expect } from "bun:test";
import { renderToString } from "react-dom/server";
import { SaveBar } from "../app/components/SaveBar";

test("renders 'Save' when dirty", () => {
  const html = renderToString(
    <SaveBar hasChanges={true} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  expect(html).toContain(">Save<");
  expect(html).not.toContain("Saved");
});

test("renders 'Saved ✓' when clean", () => {
  const html = renderToString(
    <SaveBar hasChanges={false} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  expect(html).toContain("Saved");
  expect(html).toContain("✓");
});

test("always renders Save As New", () => {
  const clean = renderToString(
    <SaveBar hasChanges={false} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  const dirty = renderToString(
    <SaveBar hasChanges={true} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  expect(clean).toContain("Save As New");
  expect(dirty).toContain("Save As New");
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
bun test packages/ui/__tests__/SaveBar.test.tsx
```

Expected: "renders 'Saved ✓' when clean" FAILs (current component returns `null` when `!hasChanges`).

- [ ] **Step 3: Implement**

Replace `packages/ui/app/components/SaveBar.tsx` with:

```tsx
interface Props {
  hasChanges: boolean;
  onSave: () => void;
  onSaveAsNew: () => void;
}

export function SaveBar({ hasChanges, onSave, onSaveAsNew }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={hasChanges ? onSave : undefined}
        disabled={!hasChanges}
        title={hasChanges ? "Save changes to active look" : "No changes to save"}
        className={
          hasChanges
            ? "px-4 py-1 bg-accent text-white text-xs font-medium rounded-sm hover:bg-accent-hover transition-colors"
            : "px-4 py-1 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-sm cursor-default"
        }
        style={{ borderRadius: "var(--radius-sm)" }}
      >
        {hasChanges ? "Save" : "Saved ✓"}
      </button>
      <button
        onClick={onSaveAsNew}
        className="px-4 py-1 bg-zinc-700 text-zinc-200 text-xs font-medium hover:bg-zinc-600 transition-colors"
        style={{ borderRadius: "var(--radius-sm)" }}
      >
        Save As New
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
bun test packages/ui/__tests__/SaveBar.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/app/components/SaveBar.tsx packages/ui/__tests__/SaveBar.test.tsx
git commit -m "feat(ui): SaveBar always visible with Saved ✓ clean state"
```

---

## Task 4: Relocate SaveBar + TopBar restructure (filename left, empty center, right cluster)

**Files:**
- Modify: `packages/ui/app/components/TopBar.tsx`
- Modify: `packages/ui/app/components/AdjustmentsPanel.tsx`
- Modify: `packages/ui/app/App.tsx`

- [ ] **Step 1: Update `TopBar` props + layout**

Replace `packages/ui/app/components/TopBar.tsx` with:

```tsx
import { useState } from "react";
import type { Renderer } from "../gpu/renderer";
import { consumeSSE } from "../lib/sse";
import { SaveBar } from "./SaveBar";

interface Props {
  filename: string | null;
  file: File | null;
  params: Record<string, string | number | boolean>;
  canvas: HTMLCanvasElement | null;
  renderer: Renderer | null;
  isVideo: boolean;
  hasChanges: boolean;
  onSave: () => void;
  onSaveAsNew: () => void;
  onExportClick: () => void;
}

type ExportState = "idle" | "uploading" | "rendering" | "done" | "error";

export function TopBar({
  filename, file, params, canvas, renderer, isVideo,
  hasChanges, onSave, onSaveAsNew, onExportClick,
}: Props) {
  const [state, setState] = useState<ExportState>("idle");
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadImage() {
    if (!renderer || !canvas) return;
    const rgba = await renderer.readPixels();
    if (rgba.length === 0) return;
    const w = canvas.width;
    const h = canvas.height;
    const offscreen = new OffscreenCanvas(w, h);
    const ctx = offscreen.getContext("2d")!;
    const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer), w, h);
    ctx.putImageData(imageData, 0, 0);
    const blob = await offscreen.convertToBlob({ type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file!.name.replace(/\.[^.]+$/, "_hanced.png");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
      <span className="text-xs text-zinc-300 truncate max-w-xs">
        {filename || ""}
      </span>

      <span />

      <div className="flex items-center gap-2">
        {file && (
          <SaveBar hasChanges={hasChanges} onSave={onSave} onSaveAsNew={onSaveAsNew} />
        )}

        {state === "idle" && file && (
          <button
            onClick={isVideo ? onExportClick : downloadImage}
            className="px-4 py-1 bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
            style={{ borderRadius: "var(--radius-sm)" }}
          >
            {isVideo ? "Export" : "Download"}
          </button>
        )}

        {(state === "uploading" || state === "rendering") && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {state === "uploading" ? "Uploading..." : `${Math.round(progress * 100)}%`}
            </span>
            <div className="w-24 h-1.5 bg-zinc-700 overflow-hidden" style={{ borderRadius: "var(--radius-sm)" }}>
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {state === "done" && downloadUrl && (
          <a
            href={downloadUrl}
            download
            onClick={() => setState("idle")}
            className="px-4 py-1 bg-success text-white text-xs font-medium"
            style={{ borderRadius: "var(--radius-sm)" }}
          >
            Download
          </a>
        )}

        {state === "error" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-danger">{error}</span>
            <button
              onClick={() => setState("idle")}
              className="px-3 py-1 bg-zinc-700 text-zinc-200 text-xs hover:bg-zinc-600 transition-colors"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export type { ExportState };
```

Key changes: removed "hance" wordmark; filename moved to left; center intentionally empty; `SaveBar` embedded in right cluster; `Export` triggers `onExportClick` callback (modal wired in Task 11) instead of immediate export. The existing inline SSE flow for images (`downloadImage`) remains; video export becomes modal-driven.

Progress/done/error states remain for post-modal export feedback (Task 11 will push state into TopBar from App).

- [ ] **Step 2: Remove SaveBar from AdjustmentsPanel**

Replace `packages/ui/app/components/AdjustmentsPanel.tsx` with:

```tsx
import { EffectGroup } from "./EffectGroup";
import type { EffectGroup as EffectGroupType } from "@hance/core";

interface Props {
  schema: EffectGroupType[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  onCommit: () => void;
  animating: boolean;
}

export function AdjustmentsPanel({ schema, values, onChange, onCommit, animating }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Adjustments</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {schema.map(group => (
          <EffectGroup
            key={group.key}
            group={group}
            values={values}
            onChange={onChange}
            onCommit={onCommit}
            animating={animating}
          />
        ))}
      </div>
    </div>
  );
}
```

Removed: `activeLookParams`, `onSave`, `onSaveAsNew`, `hasChanges` derivation, `SaveBar` import.

- [ ] **Step 3: Wire in App.tsx — compute `hasChanges` and pass new props**

In `packages/ui/app/App.tsx`:

1. Add a `hasChanges` derivation near where `activeLookParams` is destructured (after line 74):

```tsx
const hasChanges = activeLookParams !== null && Object.keys(activeLookParams).some(
  key => activeLookParams[key] !== params[key]
);
```

2. Add export-modal state near line 69 (next to `showSaveAsNew`):

```tsx
const [showExportModal, setShowExportModal] = useState(false);
```

3. Update **both** `<TopBar … />` calls (line 236 empty state and line 250 main state) to pass the new props. For the empty state (no file):

```tsx
<TopBar
  filename={null}
  file={null}
  params={params}
  canvas={null}
  renderer={null}
  isVideo={false}
  hasChanges={false}
  onSave={() => {}}
  onSaveAsNew={() => {}}
  onExportClick={() => {}}
/>
```

For the main state:

```tsx
<TopBar
  filename={file?.name || null}
  file={file}
  params={params}
  canvas={canvas}
  renderer={renderer}
  isVideo={isVideo}
  hasChanges={hasChanges}
  onSave={handleSave}
  onSaveAsNew={handleSaveAsNew}
  onExportClick={() => setShowExportModal(true)}
/>
```

4. Update the `<AdjustmentsPanel …/>` call (around line 342): remove `activeLookParams`, `onSave`, `onSaveAsNew` props. Final call:

```tsx
<AdjustmentsPanel
  schema={schema}
  values={params}
  onChange={handleParamChange}
  onCommit={commitHistory}
  animating={animating}
/>
```

- [ ] **Step 4: Manual verify**

Start dev server, load a file:
- Top bar: filename left, empty middle, `Save`/`Save As New`/`Export` on right.
- Modify a slider while a look is active → `Save` activates. Save → reverts to `Saved ✓`.
- Empty state (no file loaded): no `Save`, no `Export`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/app/components/TopBar.tsx packages/ui/app/components/AdjustmentsPanel.tsx packages/ui/app/App.tsx
git commit -m "feat(ui): relocate Save bar into top bar; filename left, empty center"
```

---

## Task 5: Adaptive timeline tick computation (TDD)

**Files:**
- Create: `packages/ui/app/components/timelineTicks.ts`
- Create: `packages/ui/__tests__/timelineTicks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/ui/__tests__/timelineTicks.test.ts`:

```ts
import { test, expect } from "bun:test";
import { computeTicks } from "../app/components/timelineTicks";

test("short clip (3s) — sub-second major interval", () => {
  const t = computeTicks(3);
  expect(t.majors.length).toBeGreaterThanOrEqual(4);
  expect(t.majors.length).toBeLessThanOrEqual(10);
  expect(t.majorInterval).toBeGreaterThan(0);
});

test("30s clip — ~6-10 majors", () => {
  const t = computeTicks(30);
  expect(t.majors.length).toBeGreaterThanOrEqual(6);
  expect(t.majors.length).toBeLessThanOrEqual(10);
});

test("5-minute clip — ~6-10 majors", () => {
  const t = computeTicks(300);
  expect(t.majors.length).toBeGreaterThanOrEqual(6);
  expect(t.majors.length).toBeLessThanOrEqual(10);
});

test("snaps to human intervals (1,2,5,10,15,30,60,...)", () => {
  const t = computeTicks(30);
  expect([1, 2, 5, 10, 15, 30, 60]).toContain(t.majorInterval);
});

test("4 minors between majors", () => {
  const t = computeTicks(30);
  expect(t.minorsPerMajor).toBe(4);
});

test("zero/invalid duration returns empty", () => {
  expect(computeTicks(0).majors).toEqual([]);
  expect(computeTicks(-1).majors).toEqual([]);
});

test("major times are within duration", () => {
  const t = computeTicks(30);
  for (const m of t.majors) {
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(30);
  }
});
```

- [ ] **Step 2: Run tests — expect fail**

```bash
bun test packages/ui/__tests__/timelineTicks.test.ts
```

Expected: all fail with "Cannot find module".

- [ ] **Step 3: Implement**

Create `packages/ui/app/components/timelineTicks.ts`:

```ts
export interface TickSet {
  majorInterval: number;
  minorsPerMajor: number;
  majors: number[];
}

const NICE_INTERVALS = [
  0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
];

export function computeTicks(duration: number, targetMajors = 8): TickSet {
  if (!(duration > 0)) return { majorInterval: 0, minorsPerMajor: 4, majors: [] };

  const raw = duration / targetMajors;
  let majorInterval = NICE_INTERVALS[0];
  for (const v of NICE_INTERVALS) {
    if (v <= raw) majorInterval = v;
  }
  const majors: number[] = [];
  for (let t = majorInterval; t <= duration + 1e-6; t += majorInterval) {
    majors.push(t);
  }
  return { majorInterval, minorsPerMajor: 4, majors };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
bun test packages/ui/__tests__/timelineTicks.test.ts
```

Expected: 7 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/app/components/timelineTicks.ts packages/ui/__tests__/timelineTicks.test.ts
git commit -m "feat(ui): adaptive timeline tick computation"
```

---

## Task 6: Timeline — transport (play left, timecode center) + ruler

**Files:**
- Modify: `packages/ui/app/components/Timeline.tsx`

- [ ] **Step 1: Add precise timecode formatter**

At the top of `packages/ui/app/components/Timeline.tsx`, add after the existing `formatTimecode`:

```ts
export function formatTimecodeFrames(seconds: number, fps = 30): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total - Math.floor(total)) * fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}
```

- [ ] **Step 2: Replace render body**

Replace the `return (...)` block (from `return (` through the closing `);`) with:

```tsx
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const ticks = computeTicks(duration);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-t border-zinc-800 select-none">
      {/* Transport row */}
      <div className="flex items-center px-3 py-1.5 gap-3">
        <button
          onClick={togglePlay}
          className="text-zinc-300 hover:text-white transition-colors flex-shrink-0"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
        <div className="flex-1 flex justify-center">
          <span
            className="text-sm text-zinc-300 tabular-nums px-3 py-0.5"
            style={{
              background: "var(--slider-track)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {formatTimecodeFrames(currentTime)}
          </span>
        </div>
        <span className="text-[11px] text-zinc-500 tabular-nums flex-shrink-0">
          {formatTimecode(duration)}
        </span>
      </div>

      {/* Scrubber + ruler */}
      <div
        ref={trackRef}
        className="relative flex-1 cursor-pointer"
        onMouseDown={onMouseDown}
      >
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-6 bg-zinc-800" style={{ borderRadius: "var(--radius-sm)" }} />

        {/* Ruler strip */}
        <div className="absolute bottom-0 inset-x-0 h-4 pointer-events-none">
          {ticks.majors.map((time, i) => {
            const percent = (time / duration) * 100;
            return (
              <div key={`M${i}`} className="absolute bottom-0" style={{ left: `${percent}%` }}>
                <div className="w-px h-2 bg-zinc-500" />
                <div className="text-[9px] text-zinc-500 tabular-nums -translate-x-1/2 mt-0.5">
                  {formatTimecode(time)}
                </div>
              </div>
            );
          })}
          {ticks.majors.flatMap((time, i) => {
            const step = ticks.majorInterval / (ticks.minorsPerMajor + 1);
            return Array.from({ length: ticks.minorsPerMajor }, (_, j) => {
              const tickTime = time - ticks.majorInterval + step * (j + 1);
              if (tickTime < 0 || tickTime > duration) return null;
              const percent = (tickTime / duration) * 100;
              return (
                <div
                  key={`m${i}-${j}`}
                  className="absolute bottom-0 w-px h-1 bg-zinc-600"
                  style={{ left: `${percent}%` }}
                />
              );
            }).filter(Boolean);
          })}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent z-10 pointer-events-none"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2 bg-accent rounded-sm" />
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 3: Add the import for `computeTicks`**

At the top of the file (after React imports):

```ts
import { computeTicks } from "./timelineTicks";
```

- [ ] **Step 4: Manual verify**

Load a video. Timeline shows play button on left, large centered timecode `HH:MM:SS:FF`, scrubber + ruler beneath with adaptive ticks, timecode pill tint matches slider track.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/app/components/Timeline.tsx
git commit -m "feat(ui): timeline transport row + adaptive ruler"
```

---

## Task 7: LookInfoModal — expanded metadata with pill chips + new radius

**Files:**
- Modify: `packages/ui/app/components/LookInfoModal.tsx`

- [ ] **Step 1: Replace component**

Replace `packages/ui/app/components/LookInfoModal.tsx` with:

```tsx
interface LookInfo {
  name: string;
  description?: string;
  keywords?: string[];
  characteristics?: string[];
}

interface Props {
  info: LookInfo;
  onClose: () => void;
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(v => (
        <span
          key={v}
          className="px-2 py-0.5 bg-zinc-700 text-zinc-200 text-[11px]"
          style={{ borderRadius: "var(--radius-sm)" }}
        >
          {v}
        </span>
      ))}
    </div>
  );
}

export function LookInfoModal({ info, onClose }: Props) {
  const hasDesc = !!info.description && info.description.trim().length > 0;
  const hasKeywords = info.keywords && info.keywords.length > 0;
  const hasChars = info.characteristics && info.characteristics.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-800 border border-zinc-700 max-w-md w-full mx-4 shadow-2xl"
        style={{ borderRadius: "var(--radius-md)", padding: "var(--pad-modal)" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-4">{info.name}</h3>
        <div className="flex flex-col gap-5 text-xs">
          {hasDesc && (
            <div>
              <div className="text-zinc-400 mb-1">Description</div>
              <div className="text-zinc-200 leading-relaxed">{info.description}</div>
            </div>
          )}
          {hasKeywords && (
            <div>
              <div className="text-zinc-400 mb-1.5">Keywords</div>
              <Chips items={info.keywords!} />
            </div>
          )}
          {hasChars && (
            <div>
              <div className="text-zinc-400 mb-1.5">Characteristics</div>
              <Chips items={info.characteristics!} />
            </div>
          )}
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="text-xs text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors"
            style={{ borderRadius: "var(--radius-sm)", padding: "var(--pad-btn)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify**

Right-click a look with all metadata set → Info → modal shows name, description paragraph, keyword chips, characteristic chips. A look with only a name shows only the name.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/app/components/LookInfoModal.tsx
git commit -m "feat(ui): expand LookInfoModal with description and chip metadata"
```

---

## Task 8: Apply radius/padding to other modals and context menu

**Files:**
- Modify: `packages/ui/app/components/NewLookModal.tsx`
- Modify: `packages/ui/app/components/DeleteLookModal.tsx`
- Modify: `packages/ui/app/components/LookContextMenu.tsx`

- [ ] **Step 1: Update `NewLookModal.tsx`**

Read the current file. Find the outer modal container `<div>` (the one with `bg-zinc-800` and `rounded-*`). Replace any `rounded-xl`/`rounded-lg` classes on the modal container with inline `style={{ borderRadius: "var(--radius-md)", padding: "var(--pad-modal)" }}` and remove any `p-*` padding classes from that same element. For any inputs inside (`<input>`, `<textarea>`) replace their `rounded-*` classes with inline `style={{ borderRadius: "var(--radius-sm)" }}`. For primary button (`Create`) use `style={{ borderRadius: "var(--radius-sm)", padding: "var(--pad-btn-primary)" }}`; secondary button (`Cancel`) use `style={{ borderRadius: "var(--radius-sm)", padding: "var(--pad-btn)" }}`. Ensure the fields have `gap-5` (~20px between field groups).

- [ ] **Step 2: Update `DeleteLookModal.tsx`**

Same treatment: container `borderRadius: var(--radius-md)`, `padding: var(--pad-modal)`; buttons `var(--radius-sm)` + `var(--pad-btn)`.

- [ ] **Step 3: Update `LookContextMenu.tsx`**

Find the context menu container. Replace rounded classes with inline `style={{ borderRadius: "var(--radius-sm)", padding: "6px 0" }}`. For each menu item `<button>` / `<div>` row, add class `"text-xs"` if missing and inline `style={{ padding: "var(--pad-menu-item)" }}` (remove any existing `px-*`/`py-*`).

- [ ] **Step 4: Manual verify**

- Open New Look modal → corners tighter, more spacious padding.
- Right-click a look → context menu has subtler radius, more breathing room per row.
- Trigger delete confirm → same treatment.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/app/components/NewLookModal.tsx packages/ui/app/components/DeleteLookModal.tsx packages/ui/app/components/LookContextMenu.tsx
git commit -m "feat(ui): apply new radius/padding tokens to modals and context menu"
```

---

## Task 9: ExportModal — form state (TDD)

**Files:**
- Create: `packages/ui/app/components/ExportModal.tsx`
- Create: `packages/ui/__tests__/ExportModal.test.tsx`

- [ ] **Step 1: Define types + write failing tests**

Create `packages/ui/__tests__/ExportModal.test.tsx`:

```tsx
import { test, expect } from "bun:test";
import { renderToString } from "react-dom/server";
import { ExportModal, crfForQuality, extForCodec } from "../app/components/ExportModal";

test("crfForQuality maps labels to numbers", () => {
  expect(crfForQuality("Visually Lossless")).toBe(17);
  expect(crfForQuality("High")).toBe(20);
  expect(crfForQuality("Medium")).toBe(23);
  expect(crfForQuality("Low")).toBe(28);
});

test("extForCodec maps codecs to extensions", () => {
  expect(extForCodec("H.264")).toBe("mp4");
  expect(extForCodec("H.265")).toBe("mp4");
  expect(extForCodec("ProRes 422")).toBe("mov");
});

test("renders Cancel and Export buttons", () => {
  const html = renderToString(
    <ExportModal
      defaultBasename="clip"
      onCancel={() => {}}
      onExport={() => {}}
    />
  );
  expect(html).toContain("Cancel");
  expect(html).toContain(">Export<");
});

test("default output path uses basename and mp4 (H.264 default)", () => {
  const html = renderToString(
    <ExportModal
      defaultBasename="clip"
      onCancel={() => {}}
      onExport={() => {}}
    />
  );
  expect(html).toContain("clip_hance.mp4");
});
```

- [ ] **Step 2: Run — expect fail**

```bash
bun test packages/ui/__tests__/ExportModal.test.tsx
```

Expected: fails "Cannot find module".

- [ ] **Step 3: Implement**

Create `packages/ui/app/components/ExportModal.tsx`:

```tsx
import { useState } from "react";

export type Codec = "H.264" | "H.265" | "ProRes 422";
export type Quality = "Visually Lossless" | "High" | "Medium" | "Low";

export interface ExportOptions {
  codec: Codec;
  crf: number;
  outputPath: string;
}

export function crfForQuality(q: Quality): number {
  switch (q) {
    case "Visually Lossless": return 17;
    case "High": return 20;
    case "Medium": return 23;
    case "Low": return 28;
  }
}

export function extForCodec(codec: Codec): "mp4" | "mov" {
  return codec === "ProRes 422" ? "mov" : "mp4";
}

interface Props {
  defaultBasename: string;
  onCancel: () => void;
  onExport: (opts: ExportOptions) => void;
}

export function ExportModal({ defaultBasename, onCancel, onExport }: Props) {
  const [codec, setCodec] = useState<Codec>("H.264");
  const [quality, setQuality] = useState<Quality>("Medium");
  const [outputPath, setOutputPath] = useState<string>(
    `${defaultBasename}_hance.${extForCodec("H.264")}`
  );

  function onCodecChange(next: Codec) {
    setCodec(next);
    setOutputPath(prev => prev.replace(/\.(mp4|mov)$/i, `.${extForCodec(next)}`));
  }

  function onChooseFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp4,.mov";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) setOutputPath(f.name);
    };
    input.click();
  }

  function submit() {
    onExport({ codec, crf: crfForQuality(quality), outputPath });
  }

  const isProRes = codec === "ProRes 422";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-zinc-800 border border-zinc-700 max-w-md w-full mx-4 shadow-2xl"
        style={{ borderRadius: "var(--radius-md)", padding: "var(--pad-modal)" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-5">Export</h3>

        <div className="flex flex-col gap-5 text-xs">
          <div>
            <div className="text-zinc-400 mb-1.5">Codec</div>
            <select
              value={codec}
              onChange={e => onCodecChange(e.target.value as Codec)}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1.5"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              <option>H.264</option>
              <option>H.265</option>
              <option>ProRes 422</option>
            </select>
          </div>

          <div>
            <div className="text-zinc-400 mb-1.5">Quality</div>
            <select
              value={quality}
              onChange={e => setQuality(e.target.value as Quality)}
              disabled={isProRes}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1.5 disabled:opacity-50"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              <option>Visually Lossless</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            {isProRes && (
              <div className="text-zinc-500 text-[11px] mt-1">ProRes uses its own profile; quality selection disabled.</div>
            )}
          </div>

          <div>
            <div className="text-zinc-400 mb-1.5">Output path</div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={outputPath}
                className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1.5"
                style={{ borderRadius: "var(--radius-sm)" }}
              />
              <button
                onClick={onChooseFile}
                className="bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
                style={{ borderRadius: "var(--radius-sm)", padding: "var(--pad-btn)" }}
              >
                Choose…
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="text-xs text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors"
            style={{ borderRadius: "var(--radius-sm)", padding: "var(--pad-btn)" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="text-xs text-white bg-accent hover:bg-accent-hover transition-colors"
            style={{ borderRadius: "var(--radius-sm)", padding: "var(--pad-btn-primary)" }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
bun test packages/ui/__tests__/ExportModal.test.tsx
```

Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/app/components/ExportModal.tsx packages/ui/__tests__/ExportModal.test.tsx
git commit -m "feat(ui): ExportModal with codec/quality/output path"
```

---

## Task 10: Wire ExportModal into App + backend params

**Files:**
- Modify: `packages/ui/app/App.tsx`
- Modify: `packages/ui/app/components/TopBar.tsx`
- Modify: `packages/ui/server.ts`

- [ ] **Step 1: Lift export flow from TopBar to App**

In `packages/ui/app/App.tsx`, add export state below `showExportModal`:

```tsx
const [exportProgress, setExportProgress] = useState<{ state: "idle" | "uploading" | "rendering" | "done" | "error"; progress: number; downloadUrl: string | null; error: string | null }>({
  state: "idle", progress: 0, downloadUrl: null, error: null,
});
```

Add handler:

```tsx
const handleExport = useCallback(async (opts: { codec: string; crf: number; outputPath: string }) => {
  if (!file) return;
  setShowExportModal(false);
  setExportProgress({ state: "uploading", progress: 0, downloadUrl: null, error: null });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("params", JSON.stringify(params));
  formData.append("codec", opts.codec);
  formData.append("crf", String(opts.crf));
  formData.append("outputName", opts.outputPath);
  try {
    const res = await fetch("/api/export", { method: "POST", body: formData });
    setExportProgress(p => ({ ...p, state: "rendering" }));
    await consumeSSE(res, {
      onProgress: (p) => setExportProgress(prev => ({ ...prev, progress: p })),
      onDone: (data) => setExportProgress({ state: "done", progress: 1, downloadUrl: data.downloadUrl as string, error: null }),
      onError: (msg) => setExportProgress({ state: "error", progress: 0, downloadUrl: null, error: msg }),
    });
  } catch (err) {
    setExportProgress({ state: "error", progress: 0, downloadUrl: null, error: (err as Error).message });
  }
}, [file, params]);
```

- [ ] **Step 2: Render modal + pass progress to TopBar**

At the bottom of the main-state return (next to `{showSaveAsNew && …}`), add:

```tsx
{showExportModal && file && (
  <ExportModal
    defaultBasename={file.name.replace(/\.[^.]+$/, "")}
    onCancel={() => setShowExportModal(false)}
    onExport={handleExport}
  />
)}
```

Add import at the top:

```tsx
import { ExportModal } from "./components/ExportModal";
```

Pass progress to `TopBar` (update the main-state `<TopBar …/>` call) — add:

```tsx
exportProgress={exportProgress}
onExportDone={() => setExportProgress({ state: "idle", progress: 0, downloadUrl: null, error: null })}
```

- [ ] **Step 3: Update TopBar to consume progress from props**

In `packages/ui/app/components/TopBar.tsx`, extend `Props`:

```tsx
  exportProgress?: { state: "idle" | "uploading" | "rendering" | "done" | "error"; progress: number; downloadUrl: string | null; error: string | null };
  onExportDone?: () => void;
```

Remove local `useState` for `state`/`progress`/`downloadUrl`/`error`. Replace references with `exportProgress?.state ?? "idle"` etc., and replace `setState("idle")` calls with `onExportDone?.()`. Keep `downloadImage()` for the image (non-video) flow as-is — image path doesn't use the modal.

- [ ] **Step 4: Accept new backend params in server**

In `packages/ui/server.ts`, locate the `/api/export` handler. Read the new form fields and forward to the existing CLI/FFmpeg invocation:

```ts
const codec = String(form.get("codec") ?? "H.264");
const crf = Number(form.get("crf") ?? 23);
const outputName = String(form.get("outputName") ?? "");
```

Pass these through to the existing pipeline call (wherever it constructs FFmpeg args). Map:

- Codec `"H.264"` → `-c:v libx264`
- Codec `"H.265"` → `-c:v libx265`
- Codec `"ProRes 422"` → `-c:v prores_ks -profile:v 3` (omit `-crf`)
- Non-ProRes: add `-crf ${crf}`
- Output filename: if `outputName` is a bare filename (no path separator), place into the existing export dir under that name; otherwise use as-is.

(Inspect `packages/ui/server.ts` before editing to match existing arg construction style; the mapping above goes alongside the current encoder args.)

- [ ] **Step 5: Manual verify**

Load a video, click Export → modal opens. Choose H.265 + High + default path → Export. Progress shows in top bar. On completion, Download link works and produces an `.mp4` encoded with h265 + crf 20. Switch to ProRes → Quality dropdown disables, output suffix switches to `.mov`.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/app/App.tsx packages/ui/app/components/TopBar.tsx packages/ui/server.ts
git commit -m "feat(ui,server): wire ExportModal with codec/crf/output path"
```

---

## Task 11: ViewMode state + ViewModeToolbar

**Files:**
- Create: `packages/ui/app/components/ViewModeToolbar.tsx`
- Modify: `packages/ui/app/App.tsx`

- [ ] **Step 1: Create toolbar**

Create `packages/ui/app/components/ViewModeToolbar.tsx`:

```tsx
export type ViewMode = "normal" | "split" | "reference";

interface Props {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  referenceDisabled?: boolean;
  splitDisabled?: boolean;
}

function IconNormal() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" /></svg>;
}
function IconSplit() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" /><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.25" /></svg>;
}
function IconReference() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" /><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.25" /><path d="M10.5 7.5l1.5 1.5 1.5-1.5" stroke="currentColor" strokeWidth="1.25" fill="none" /></svg>;
}

export function ViewModeToolbar({ mode, onChange, referenceDisabled, splitDisabled }: Props) {
  const base = "p-1.5 transition-colors";
  const active = "text-zinc-100 bg-zinc-700";
  const idle = "text-zinc-400 hover:text-zinc-200";
  const disabled = "text-zinc-600 cursor-not-allowed";
  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 z-20"
      style={{ borderRadius: "var(--radius-sm)", padding: "4px 6px" }}
    >
      <button
        onClick={() => onChange("normal")}
        className={`${base} ${mode === "normal" ? active : idle}`}
        style={{ borderRadius: "var(--radius-sm)" }}
        aria-label="Normal view"
      ><IconNormal /></button>
      <button
        onClick={() => !splitDisabled && onChange("split")}
        disabled={splitDisabled}
        className={`${base} ${mode === "split" ? active : splitDisabled ? disabled : idle}`}
        style={{ borderRadius: "var(--radius-sm)" }}
        aria-label="Split compare"
      ><IconSplit /></button>
      <button
        onClick={() => !referenceDisabled && onChange("reference")}
        disabled={referenceDisabled}
        className={`${base} ${mode === "reference" ? active : referenceDisabled ? disabled : idle}`}
        style={{ borderRadius: "var(--radius-sm)" }}
        aria-label="Reference compare"
      ><IconReference /></button>
    </div>
  );
}
```

- [ ] **Step 2: Wire state in App.tsx**

In `packages/ui/app/App.tsx`, add imports + state:

```tsx
import { ViewModeToolbar, type ViewMode } from "./components/ViewModeToolbar";
// …
const [viewMode, setViewMode] = useState<ViewMode>("normal");
const [referenceImage, setReferenceImage] = useState<string | null>(null);
const [splitPosition, setSplitPosition] = useState(0.5);
```

In the center canvas container (`<div className="flex-1 flex items-center justify-center p-4 min-w-0">`), change it to `relative` and render the toolbar as the first child when a file is loaded:

```tsx
<div className="flex-1 flex items-center justify-center p-4 min-w-0 relative">
  {file && (
    <ViewModeToolbar
      mode={viewMode}
      onChange={setViewMode}
      splitDisabled={!file}
      referenceDisabled={false}
    />
  )}
  {/* …existing contents (previewError block OR Canvas)… */}
</div>
```

- [ ] **Step 3: Manual verify**

Toolbar appears centered at the top of the canvas area when a file is loaded. Clicking icons toggles active state (no visual compare yet — that's Task 12).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/app/components/ViewModeToolbar.tsx packages/ui/app/App.tsx
git commit -m "feat(ui): add ViewModeToolbar and view mode state"
```

---

## Task 12: Split-compare overlay (before/after) + reference-compare

**Files:**
- Create: `packages/ui/app/components/CompareOverlay.tsx`
- Modify: `packages/ui/app/App.tsx`
- Modify: `packages/ui/app/components/Canvas.tsx`

**Approach:** Processed canvas renders as the base layer (unchanged). On top, an absolutely-positioned "overlay" element shows either the original source (split mode) or the user's reference image (reference mode), clipped with `clip-path: inset(0 X% 0 0)` where X is controlled by a draggable vertical divider. Drag the divider → update `splitPosition` (0..1). This keeps the WebGPU renderer untouched.

- [ ] **Step 1: Expose the canvas bounding rect**

In `packages/ui/app/components/Canvas.tsx`, the root wrapper `<div className="relative flex-1 …">` already relatively-positions. No change needed — the overlay will be a sibling rendered by App.

- [ ] **Step 2: Create CompareOverlay**

Create `packages/ui/app/components/CompareOverlay.tsx`:

```tsx
import { useRef, useCallback, useEffect } from "react";

interface Props {
  mode: "split" | "reference";
  position: number;
  onPositionChange: (p: number) => void;
  overlaySrc: string;
  isVideo: boolean;
  videoRef?: HTMLVideoElement | null;
  canvasRect: { left: number; top: number; width: number; height: number } | null;
}

export function CompareOverlay({ mode, position, onPositionChange, overlaySrc, isVideo, videoRef, canvasRect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isVideo || !videoRef || !localVideoRef.current) return;
    const local = localVideoRef.current;
    function sync() {
      if (Math.abs(local.currentTime - videoRef!.currentTime) > 0.05) {
        local.currentTime = videoRef!.currentTime;
      }
      if (videoRef!.paused && !local.paused) local.pause();
      if (!videoRef!.paused && local.paused) local.play().catch(() => {});
    }
    const id = setInterval(sync, 50);
    return () => clearInterval(id);
  }, [isVideo, videoRef]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    function move(ev: MouseEvent) {
      if (!canvasRect || canvasRect.width === 0) return;
      const x = ev.clientX - canvasRect.left;
      onPositionChange(Math.max(0, Math.min(1, x / canvasRect.width)));
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [canvasRect, onPositionChange]);

  if (!canvasRect) return null;

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    left: canvasRect.left,
    top: canvasRect.top,
    width: canvasRect.width,
    height: canvasRect.height,
    clipPath: `inset(0 ${(1 - position) * 100}% 0 0)`,
    pointerEvents: "none",
    objectFit: mode === "reference" ? "contain" : "fill",
    background: mode === "reference" ? "#000" : "transparent",
    zIndex: 15,
  };

  const dividerStyle: React.CSSProperties = {
    position: "absolute",
    left: canvasRect.left + canvasRect.width * position,
    top: canvasRect.top,
    height: canvasRect.height,
    transform: "translateX(-1px)",
    zIndex: 20,
  };

  return (
    <div ref={containerRef}>
      {mode === "split" && isVideo ? (
        <video ref={localVideoRef} src={overlaySrc} style={overlayStyle} muted playsInline />
      ) : (
        <img src={overlaySrc} style={overlayStyle} alt="" />
      )}
      <div style={dividerStyle} className="pointer-events-auto">
        <div className="w-0.5 h-full bg-white/70" />
        <div
          onMouseDown={onMouseDown}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 rounded-full cursor-ew-resize flex items-center justify-center text-[10px] text-zinc-800 font-bold"
        >‹›</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Track canvas rect + render overlay in App**

In `packages/ui/app/App.tsx`:

1. Add canvas-rect state:

```tsx
const [canvasRect, setCanvasRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
```

2. After the existing `useEffect` for keybinds, add rect tracking:

```tsx
useEffect(() => {
  if (!canvas) { setCanvasRect(null); return; }
  function update() {
    const r = canvas!.getBoundingClientRect();
    setCanvasRect({ left: r.left, top: r.top, width: r.width, height: r.height });
  }
  update();
  const ro = new ResizeObserver(update);
  ro.observe(canvas);
  window.addEventListener("scroll", update, true);
  window.addEventListener("resize", update);
  return () => { ro.disconnect(); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
}, [canvas]);
```

3. Add reference upload handler and render overlay. At the bottom of the main-state return (next to `{showSaveAsNew && …}`):

```tsx
{viewMode === "split" && previewSrc && canvasRect && (
  <CompareOverlay
    mode="split"
    position={splitPosition}
    onPositionChange={setSplitPosition}
    overlaySrc={previewSrc}
    isVideo={isVideo}
    videoRef={videoElement}
    canvasRect={canvasRect}
  />
)}
{viewMode === "reference" && !referenceImage && canvasRect && (
  <div
    className="absolute bg-zinc-900/90 border border-zinc-700 px-4 py-3 z-30 flex flex-col items-center gap-2"
    style={{
      left: canvasRect.left + canvasRect.width / 2 - 110,
      top: canvasRect.top + canvasRect.height / 2 - 30,
      borderRadius: "var(--radius-md)",
    }}
  >
    <div className="text-xs text-zinc-300">Upload a reference image</div>
    <button
      onClick={() => {
        const i = document.createElement("input");
        i.type = "file"; i.accept = "image/*";
        i.onchange = () => {
          const f = i.files?.[0]; if (!f) return;
          setReferenceImage(URL.createObjectURL(f));
        };
        i.click();
      }}
      className="text-xs text-white bg-accent hover:bg-accent-hover"
      style={{ borderRadius: "var(--radius-sm)", padding: "var(--pad-btn)" }}
    >Choose image…</button>
  </div>
)}
{viewMode === "reference" && referenceImage && canvasRect && (
  <>
    <CompareOverlay
      mode="reference"
      position={splitPosition}
      onPositionChange={setSplitPosition}
      overlaySrc={referenceImage}
      isVideo={false}
      canvasRect={canvasRect}
    />
    <button
      onClick={() => setReferenceImage(null)}
      className="absolute text-[11px] text-zinc-300 bg-zinc-800/90 border border-zinc-700 hover:bg-zinc-700 z-30"
      style={{
        right: `calc(100vw - ${canvasRect.left + canvasRect.width}px + 8px)`,
        top: canvasRect.top + 8,
        borderRadius: "var(--radius-sm)",
        padding: "4px 10px",
      }}
    >Replace reference</button>
  </>
)}
```

4. Clear reference + reset position when file changes. Add to the existing `useEffect` that resets on `objectUrl`:

```tsx
setReferenceImage(null);
setViewMode("normal");
setSplitPosition(0.5);
```

5. Add import at top:

```tsx
import { CompareOverlay } from "./components/CompareOverlay";
```

- [ ] **Step 4: Manual verify**

- Load a video. Click split icon → vertical divider at center. Left = original, right = processed. Drag divider → clip moves. Play video → both sides play in sync.
- Click reference icon → prompted to upload. Upload a different image → left = processed, right = reference letterboxed.
- Click Replace reference → prompted to upload again.
- Switching files clears reference and returns to normal mode.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/app/components/CompareOverlay.tsx packages/ui/app/App.tsx
git commit -m "feat(ui): split-compare and reference-compare view modes"
```

---

## Task 13: Sweep — verify full build + all tests

**Files:** none

- [ ] **Step 1: Typecheck and build**

```bash
bun run build
```

Expected: binary builds without TS errors.

- [ ] **Step 2: Run full test suite**

```bash
bun test
```

Expected: all tests pass (including new ones).

- [ ] **Step 3: Manual end-to-end sweep with `agent-browser --auto-connect`**

Walk the full UI once more:
- Empty state top bar: filename empty, no save/export.
- Load video: filename appears, Save/Saved/Export visible, slider restyle applied, timeline transport+ruler, view mode toolbar centered over canvas.
- Split mode → divider drag.
- Reference mode → upload → letterboxed compare.
- Right-click look → context menu + Info modal show new radii/padding/chip metadata.
- Export button → modal → export H.264 Medium → download works.
- Save As New → modal uses new radii.

- [ ] **Step 4: No commit**

This task is verification-only.

---

## Task 14: Changeset note (optional)

**Files:**
- Modify: repository root if a CHANGELOG is maintained — otherwise skip.

- [ ] **Step 1: Check for CHANGELOG**

```bash
ls CHANGELOG.md 2>/dev/null
```

If present, add a `## [Unreleased]` entry summarizing: "UI redesign: new top bar layout, thin sliders, adaptive timeline ruler, split-compare view modes, Export modal, expanded Look info modal." Commit with `chore: changelog for UI redesign`. Otherwise skip.

---
