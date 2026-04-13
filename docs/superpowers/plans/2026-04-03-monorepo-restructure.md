# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the flat `src/` layout into a Bun workspace monorepo with `packages/core`, `packages/cli`, `packages/ui`, and `packages/wgpu`.

**Architecture:** Files move from `src/` into package directories. Imports change from relative paths to `@hance/core` and `@hance/cli` workspace references. No behavior changes — every function stays identical.

**Tech Stack:** Bun workspaces, TypeScript, Cargo (Rust)

---

### Task 1: Create package directories and package.json files

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/cli/package.json`
- Create: `packages/ui/package.json`
- Create: `packages/core/src/` (empty dir)
- Create: `packages/cli/src/` (empty dir)
- Create: `apps/desktop/` (empty placeholder)
- Modify: `package.json` (root)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/core/src packages/cli/src packages/cli/__tests__/e2e/fixtures packages/cli/__tests__/gpu packages/ui/__tests__ apps/desktop
```

- [ ] **Step 2: Create `packages/core/package.json`**

```json
{
  "name": "@hance/core",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts"
}
```

- [ ] **Step 3: Create `packages/cli/package.json`**

```json
{
  "name": "@hance/cli",
  "version": "1.0.0",
  "type": "module",
  "main": "src/cli.ts",
  "dependencies": {
    "@hance/core": "workspace:*"
  }
}
```

- [ ] **Step 4: Create `packages/ui/package.json`**

```json
{
  "name": "@hance/ui",
  "version": "1.0.0",
  "type": "module",
  "main": "server.ts",
  "dependencies": {
    "@hance/core": "workspace:*",
    "@hance/cli": "workspace:*",
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3"
  }
}
```

- [ ] **Step 5: Update root `package.json`**

```json
{
  "name": "hance",
  "version": "1.0.0",
  "type": "module",
  "workspaces": ["packages/core", "packages/cli", "packages/ui"],
  "scripts": {
    "start": "bun run packages/cli/src/cli.ts",
    "build": "bun run build:wgpu && bun run build:ui && bun build packages/cli/src/cli.ts --compile --outfile hance",
    "build:ui": "bun run scripts/build-ui.ts",
    "build:wgpu": "cd packages/wgpu && ~/.cargo/bin/cargo build --release",
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "^1.3.11"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json packages/cli/package.json packages/ui/package.json package.json apps/desktop
git commit -m "chore: create monorepo package structure with Bun workspaces"
```

---

### Task 2: Move core files (types, schema, presets, probe, shaders)

**Files:**
- Move: `src/types.ts` → `packages/core/src/types.ts`
- Move: `src/schema.ts` → `packages/core/src/schema.ts`
- Move: `src/presets.ts` → `packages/core/src/presets.ts`
- Move: `src/probe.ts` → `packages/core/src/probe.ts`
- Move: `src/shaders/` → `packages/core/shaders/`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Move source files**

```bash
mv src/types.ts packages/core/src/types.ts
mv src/schema.ts packages/core/src/schema.ts
mv src/presets.ts packages/core/src/presets.ts
mv src/probe.ts packages/core/src/probe.ts
mv src/shaders packages/core/shaders
```

- [ ] **Step 2: Fix `presets.ts` import path**

In `packages/core/src/presets.ts`, the import `from "./types"` stays the same (still relative within core). But `builtinPresetsDir()` needs updating since it uses `import.meta.dir` and `"..", "presets"` which assumed the old location.

Change `builtinPresetsDir()` in `packages/core/src/presets.ts`:

```typescript
export function builtinPresetsDir(): string {
  return join(import.meta.dir, "..", "..", "..", "presets");
}
```

The path from `packages/core/src/` up to the repo root is `../../..`, then into `presets/`.

- [ ] **Step 3: Create barrel export `packages/core/src/index.ts`**

```typescript
export type {
  ColorSettingsOptions, HalationOptions, AberrationOptions,
  BloomOptions, GrainOptions, VignetteOptions, SplitToneOptions,
  CameraShakeOptions, FilmOptions, OutputCodec, ProbeResult,
} from "./types";

export type { RangeOption, SelectOption, BooleanOption, OptionDef, EffectGroup } from "./schema";
export { EFFECT_SCHEMA, getDefaults } from "./schema";

export type { PresetData } from "./presets";
export { loadPreset, applyPreset, builtinPresetsDir, userPresetsDir } from "./presets";

export { probe, parseProbeOutput } from "./probe";
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/ presets/
git add -u src/types.ts src/schema.ts src/presets.ts src/probe.ts src/shaders
git commit -m "refactor: move core files (types, schema, presets, probe, shaders) to packages/core"
```

---

### Task 3: Move CLI files

**Files:**
- Move: `src/cli.ts` → `packages/cli/src/cli.ts`
- Move: `src/pipeline.ts` → `packages/cli/src/pipeline.ts`
- Move: `src/progress.ts` → `packages/cli/src/progress.ts`
- Move: `src/gpu/` → `packages/cli/src/gpu/`

- [ ] **Step 1: Move source files**

```bash
mv src/cli.ts packages/cli/src/cli.ts
mv src/pipeline.ts packages/cli/src/pipeline.ts
mv src/progress.ts packages/cli/src/progress.ts
mv src/gpu packages/cli/src/gpu
```

- [ ] **Step 2: Update imports in `packages/cli/src/cli.ts`**

Replace the imports at the top of `packages/cli/src/cli.ts`:

```typescript
import { existsSync } from "node:fs";
import { probe } from "@hance/core";
import { applyPreset } from "@hance/core";
import type { PresetData } from "@hance/core";
import type { FilmOptions } from "@hance/core";
import { runGpuExport } from "./pipeline";
import path from "node:path";
```

Or combined:

```typescript
import { existsSync } from "node:fs";
import { probe, applyPreset } from "@hance/core";
import type { PresetData, FilmOptions } from "@hance/core";
import { runGpuExport } from "./pipeline";
import path from "node:path";
```

Also update the dynamic import for the UI server. In the `main()` function, change:

```typescript
const { startUI } = await import("./ui/server");
```

to:

```typescript
const { startUI } = await import("@hance/ui/server");
```

And update the dynamic import for the GPU renderer. In the image processing block, change:

```typescript
const { createHeadlessRenderer } = await import("./gpu/wgpu-renderer");
```

This stays the same — it's still relative within `packages/cli/src/`.

- [ ] **Step 3: Update imports in `packages/cli/src/pipeline.ts`**

Replace:

```typescript
import type { ProbeResult, OutputCodec } from "./types";
import { createHeadlessRenderer } from "./gpu/wgpu-renderer";
```

with:

```typescript
import type { ProbeResult, OutputCodec } from "@hance/core";
import { createHeadlessRenderer } from "./gpu/wgpu-renderer";
```

- [ ] **Step 4: Update sidecar path in `packages/cli/src/gpu/wgpu-renderer.ts`**

Change `sidecarPath()`:

```typescript
function sidecarPath(): string {
  const devPath = join(import.meta.dir, "..", "..", "..", "wgpu", "target", "release", "hance-gpu");
  return devPath;
}
```

The path from `packages/cli/src/gpu/` to `packages/wgpu/` is `../../../wgpu/`.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/
git add -u src/cli.ts src/pipeline.ts src/progress.ts src/gpu
git commit -m "refactor: move CLI files to packages/cli"
```

---

### Task 4: Move UI files

**Files:**
- Move: `src/ui/server.ts` → `packages/ui/server.ts`
- Move: `src/ui/app/` → `packages/ui/app/`
- Move: `src/ui/dist/` → `packages/ui/dist/`

- [ ] **Step 1: Move source files**

```bash
mv src/ui/server.ts packages/ui/server.ts
mv src/ui/app packages/ui/app
mv src/ui/dist packages/ui/dist
```

- [ ] **Step 2: Update imports in `packages/ui/server.ts`**

Replace:

```typescript
import { EFFECT_SCHEMA } from "../schema";
import { loadPreset, builtinPresetsDir, userPresetsDir } from "../presets";
import type { PresetData } from "../presets";
import { runGpuExport } from "../pipeline";
import { probe } from "../probe";
```

with:

```typescript
import { EFFECT_SCHEMA, loadPreset, builtinPresetsDir, userPresetsDir, probe } from "@hance/core";
import type { PresetData } from "@hance/core";
import { runGpuExport } from "@hance/cli/src/pipeline";
```

- [ ] **Step 3: Update shader imports in `packages/ui/app/gpu/shaders.ts`**

Replace all shader imports. The path from `packages/ui/app/gpu/` to `packages/core/shaders/` is `../../../core/shaders/`:

```typescript
// @ts-nocheck — Bun handles .wgsl as text imports
import FULLSCREEN_VERT from "../../../core/shaders/fullscreen.vert.wgsl";
import COLOR_SETTINGS_FRAG from "../../../core/shaders/color-settings.frag.wgsl";
import THRESHOLD_FRAG from "../../../core/shaders/threshold.frag.wgsl";
import BLUR_FRAG from "../../../core/shaders/blur.frag.wgsl";
import SCREEN_BLEND_FRAG from "../../../core/shaders/screen-blend.frag.wgsl";
import ABERRATION_FRAG from "../../../core/shaders/aberration.frag.wgsl";
import GRAIN_FRAG from "../../../core/shaders/grain.frag.wgsl";
import VIGNETTE_FRAG from "../../../core/shaders/vignette.frag.wgsl";
import SPLIT_TONE_FRAG from "../../../core/shaders/split-tone.frag.wgsl";
import CAMERA_SHAKE_FRAG from "../../../core/shaders/camera-shake.frag.wgsl";
```

- [ ] **Step 4: Update schema imports in UI components**

In `packages/ui/app/components/ControlsPanel.tsx`, change:

```typescript
import type { EffectGroup as EffectGroupType } from "../../../schema";
```

to:

```typescript
import type { EffectGroup as EffectGroupType } from "@hance/core";
```

In `packages/ui/app/components/EffectGroup.tsx`, change:

```typescript
import type { EffectGroup as EffectGroupType, OptionDef } from "../../../schema";
```

to:

```typescript
import type { EffectGroup as EffectGroupType, OptionDef } from "@hance/core";
```

- [ ] **Step 5: Commit**

```bash
git add packages/ui/
git add -u src/ui
git commit -m "refactor: move UI files to packages/ui"
```

---

### Task 5: Move sidecar to packages/wgpu

**Files:**
- Move: `sidecar/` → `packages/wgpu/`
- Modify: `packages/wgpu/src/renderer.rs` (shader include paths)

- [ ] **Step 1: Move sidecar directory**

```bash
mv sidecar packages/wgpu
```

- [ ] **Step 2: Update `include_str!` paths in `packages/wgpu/src/renderer.rs`**

The shaders moved from `src/shaders/` (relative `../../src/shaders/` from old `sidecar/src/`) to `packages/core/shaders/` (relative `../../core/shaders/` from new `packages/wgpu/src/`).

Replace lines 7-16:

```rust
const VERT: &str = include_str!("../../core/shaders/fullscreen.vert.wgsl");
const COLOR_FRAG: &str = include_str!("../../core/shaders/color-settings.frag.wgsl");
const THRESHOLD_FRAG: &str = include_str!("../../core/shaders/threshold.frag.wgsl");
const BLUR_FRAG: &str = include_str!("../../core/shaders/blur.frag.wgsl");
const BLEND_FRAG: &str = include_str!("../../core/shaders/screen-blend.frag.wgsl");
const ABERRATION_FRAG: &str = include_str!("../../core/shaders/aberration.frag.wgsl");
const GRAIN_FRAG: &str = include_str!("../../core/shaders/grain.frag.wgsl");
const VIGNETTE_FRAG: &str = include_str!("../../core/shaders/vignette.frag.wgsl");
const SPLIT_TONE_FRAG: &str = include_str!("../../core/shaders/split-tone.frag.wgsl");
const SHAKE_FRAG: &str = include_str!("../../core/shaders/camera-shake.frag.wgsl");
```

- [ ] **Step 3: Commit**

```bash
git add packages/wgpu/
git add -u sidecar
git commit -m "refactor: move sidecar to packages/wgpu, update shader paths"
```

---

### Task 6: Move tests to their packages

**Files:**
- Move: `src/__tests__/schema.test.ts` → `packages/core/__tests__/schema.test.ts`
- Move: `src/__tests__/presets.test.ts` → `packages/core/__tests__/presets.test.ts`
- Move: `src/__tests__/probe.test.ts` → `packages/core/__tests__/probe.test.ts`
- Move: `src/__tests__/progress.test.ts` → `packages/cli/__tests__/progress.test.ts`
- Move: `src/__tests__/cli.test.ts` → `packages/cli/__tests__/cli.test.ts`
- Move: `src/__tests__/gpu/` → `packages/cli/__tests__/gpu/`
- Move: `src/__tests__/e2e/` → `packages/cli/__tests__/e2e/`
- Move: `src/__tests__/ui/` → `packages/ui/__tests__/`

- [ ] **Step 1: Create test directories**

```bash
mkdir -p packages/core/__tests__
```

- [ ] **Step 2: Move core tests**

```bash
mv src/__tests__/schema.test.ts packages/core/__tests__/schema.test.ts
mv src/__tests__/presets.test.ts packages/core/__tests__/presets.test.ts
mv src/__tests__/probe.test.ts packages/core/__tests__/probe.test.ts
```

- [ ] **Step 3: Update core test imports**

In `packages/core/__tests__/schema.test.ts`, change:

```typescript
import { EFFECT_SCHEMA, getDefaults } from "../schema";
```

to:

```typescript
import { EFFECT_SCHEMA, getDefaults } from "../src/schema";
```

In `packages/core/__tests__/presets.test.ts`, change:

```typescript
import { loadPreset, applyPreset } from "../presets";
```

to:

```typescript
import { loadPreset, applyPreset } from "../src/presets";
```

In `packages/core/__tests__/probe.test.ts`, change:

```typescript
import { parseProbeOutput } from "../probe";
```

to:

```typescript
import { parseProbeOutput } from "../src/probe";
```

- [ ] **Step 4: Move CLI tests**

```bash
mv src/__tests__/cli.test.ts packages/cli/__tests__/cli.test.ts
mv src/__tests__/progress.test.ts packages/cli/__tests__/progress.test.ts
mv src/__tests__/gpu/headless-renderer.test.ts packages/cli/__tests__/gpu/headless-renderer.test.ts
mv src/__tests__/e2e packages/cli/__tests__/e2e
```

- [ ] **Step 5: Update CLI test imports**

In `packages/cli/__tests__/cli.test.ts`, change:

```typescript
import { parseArgs, getDefaultOutput, isSubcommand } from "../cli";
```

to:

```typescript
import { parseArgs, getDefaultOutput, isSubcommand } from "../src/cli";
```

In `packages/cli/__tests__/progress.test.ts`, change:

```typescript
import { renderProgressBar, parseProgress } from "../progress";
```

to:

```typescript
import { renderProgressBar, parseProgress } from "../src/progress";
```

In `packages/cli/__tests__/gpu/headless-renderer.test.ts`, change:

```typescript
import { createHeadlessRenderer, type HeadlessRenderer } from "../../gpu/wgpu-renderer";
```

to:

```typescript
import { createHeadlessRenderer, type HeadlessRenderer } from "../../src/gpu/wgpu-renderer";
```

In `packages/cli/__tests__/e2e/gpu-export.test.ts`, change:

```typescript
import { createHeadlessRenderer } from "../../gpu/wgpu-renderer";
```

to:

```typescript
import { createHeadlessRenderer } from "../../src/gpu/wgpu-renderer";
```

In `packages/cli/__tests__/e2e/hance.e2e.test.ts`, change `CLI_PATH`:

```typescript
const CLI_PATH = path.join(import.meta.dir, "../../src/cli.ts");
```

- [ ] **Step 6: Move UI tests**

```bash
mv src/__tests__/ui/server.test.ts packages/ui/__tests__/server.test.ts
mv src/__tests__/ui/mediaSizing.test.ts packages/ui/__tests__/mediaSizing.test.ts
```

- [ ] **Step 7: Update UI test imports**

In `packages/ui/__tests__/server.test.ts`, change:

```typescript
import { createServer } from "../../ui/server";
```

to:

```typescript
import { createServer } from "../server";
```

In `packages/ui/__tests__/mediaSizing.test.ts`, change:

```typescript
import { fitPreviewSize } from "../../ui/app/mediaSizing";
```

to:

```typescript
import { fitPreviewSize } from "../app/mediaSizing";
```

- [ ] **Step 8: Move e2e UI API test to UI package**

The file `packages/cli/__tests__/e2e/ui-api.e2e.test.ts` tests the UI server API, so it belongs in `packages/ui`:

```bash
mv packages/cli/__tests__/e2e/ui-api.e2e.test.ts packages/ui/__tests__/ui-api.e2e.test.ts
```

Update its import:

```typescript
import { createServer } from "../server";
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/__tests__/ packages/cli/__tests__/ packages/ui/__tests__/
git add -u src/__tests__
git commit -m "refactor: move tests to their respective packages"
```

---

### Task 7: Update config files

**Files:**
- Modify: `tsconfig.json` (root base config)
- Create: `packages/core/tsconfig.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/ui/tsconfig.json`
- Modify: `bunfig.toml`
- Modify: `scripts/build-ui.ts`

- [ ] **Step 1: Update root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["bun-types"],
    "jsx": "react-jsx"
  }
}
```

Remove `outDir`, `rootDir`, and `include` — each package defines its own.

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "jsx": "react-jsx"
  },
  "include": ["server.ts", "app"]
}
```

- [ ] **Step 5: Update `bunfig.toml`**

Remove the `[test]` root setting since tests are now in each package:

```toml
[test]
root = "packages"
```

- [ ] **Step 6: Update `scripts/build-ui.ts`**

Change all paths from `src/ui/` to `packages/ui/`:

```typescript
import { join } from "node:path";

// Build main UI
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "packages", "ui", "app", "index.tsx")],
  outdir: join(import.meta.dir, "..", "packages", "ui", "dist"),
  minify: true,
  target: "browser",
  loader: { ".wgsl": "text" },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const html = await Bun.file(join(import.meta.dir, "..", "packages", "ui", "app", "index.html")).text();
const jsFile = result.outputs.find(o => o.path.endsWith(".js"));
const jsName = jsFile ? jsFile.path.split("/").pop() : "index.js";
const injected = html.replace("<!-- SCRIPT -->", `<script type="module" src="/${jsName}"></script>`);
await Bun.write(join(import.meta.dir, "..", "packages", "ui", "dist", "index.html"), injected);

console.log("UI built successfully");
```

- [ ] **Step 7: Update `packages/ui/server.ts` static file path**

In `packages/ui/server.ts`, the static serving uses `import.meta.dir` to find `dist/`. Since `server.ts` is now at `packages/ui/server.ts` and `dist/` is at `packages/ui/dist/`, the existing `join(import.meta.dir, "dist")` path still works. No change needed.

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json bunfig.toml scripts/build-ui.ts packages/core/tsconfig.json packages/cli/tsconfig.json packages/ui/tsconfig.json
git commit -m "chore: update config files for monorepo structure"
```

---

### Task 8: Clean up old src/ directory and install dependencies

**Files:**
- Remove: `src/` (should be empty after all moves)
- Modify: `CLAUDE.md` (update commands)

- [ ] **Step 1: Verify src/ is empty and remove it**

```bash
ls src/
```

Expected: empty (all files moved). If empty:

```bash
rmdir src
```

If `src/ui/` still has empty subdirs:

```bash
rm -rf src
```

- [ ] **Step 2: Install workspace dependencies**

```bash
bun install
```

This resolves the workspace links for `@hance/core` and `@hance/cli`.

- [ ] **Step 3: Update `CLAUDE.md` commands**

Update the Commands section:

```markdown
## Commands
- Run dev: `bun run packages/cli/src/cli.ts <input> [options]`
- Build binary: `bun run build`
- Run tests: `bun test`
- Run e2e tests: `bun test packages/cli/__tests__/e2e/`
```

- [ ] **Step 4: Commit**

```bash
git add -u src CLAUDE.md bun.lock
git commit -m "chore: remove old src/, update CLAUDE.md, install workspace deps"
```

---

### Task 9: Run all tests and verify

- [ ] **Step 1: Run all tests**

```bash
bun test
```

Expected: All tests pass — same count as before the restructure.

- [ ] **Step 2: Run e2e tests specifically**

```bash
bun test packages/cli/__tests__/e2e/
```

Expected: All e2e tests pass.

- [ ] **Step 3: Verify the CLI runs**

```bash
bun run packages/cli/src/cli.ts --help
```

Expected: Help text prints correctly.

- [ ] **Step 4: Fix any import issues**

If any test fails due to import paths, fix the path and re-run. Common issues:
- Relative imports that were missed in the rewiring
- `import.meta.dir` paths that need depth adjustment

- [ ] **Step 5: Verify Rust sidecar builds**

```bash
cd packages/wgpu && ~/.cargo/bin/cargo build --release
```

Expected: Builds successfully with the updated `include_str!` paths.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve import paths after monorepo restructure"
```

(Only if fixes were needed.)

---

### Task 10: Update documentation

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `ROADMAP.md`
- Modify: `.gitignore`

- [ ] **Step 1: Update ARCHITECTURE.md**

Update the directory tree to reflect the actual structure, and rename sidecar references to wgpu.

- [ ] **Step 2: Update ROADMAP.md**

Mark the completed items:

```markdown
- [x] Restructure into monorepo (packages/core, cli, ui, wgpu + apps/desktop)
- [x] Separate CLI and UI into independent Bun-compiled binaries
- [x] Set up Bun workspaces
```

- [ ] **Step 3: Update `.gitignore` if needed**

Ensure `packages/wgpu/target/` is ignored (was `sidecar/target/`). Check if the existing `.gitignore` or `sidecar/.gitignore` handles this.

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md ROADMAP.md .gitignore
git commit -m "docs: update architecture and roadmap for monorepo structure"
```
