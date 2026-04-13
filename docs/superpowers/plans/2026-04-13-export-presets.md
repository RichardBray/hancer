# Export Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--export <low|medium|high|max>` flag that bundles codec, CRF, encode preset, and pixel format into quality tiers.

**Architecture:** Export preset definitions live in `packages/core` as a pure data mapping. The CLI parses the flag, resolves it against any individual overrides, and passes the result to the existing pipeline. Pixel format becomes a configurable part of encoder settings rather than hardcoded.

**Tech Stack:** TypeScript, Bun, bun:test

---

### Task 1: Add export preset types and data to core

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/export-presets.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/__tests__/export-presets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/__tests__/export-presets.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { EXPORT_PRESETS, resolveExportPreset } from "@hance/core";

describe("EXPORT_PRESETS", () => {
  it("defines all four tiers", () => {
    expect(EXPORT_PRESETS.low).toBeDefined();
    expect(EXPORT_PRESETS.medium).toBeDefined();
    expect(EXPORT_PRESETS.high).toBeDefined();
    expect(EXPORT_PRESETS.max).toBeDefined();
  });

  it("low uses h264, crf 23, fast, 8-bit", () => {
    expect(EXPORT_PRESETS.low).toEqual({
      codec: "h264",
      crf: 23,
      encodePreset: "fast",
      pixelFormat: "yuv420p",
    });
  });

  it("medium uses h264, crf 18, medium, 8-bit", () => {
    expect(EXPORT_PRESETS.medium).toEqual({
      codec: "h264",
      crf: 18,
      encodePreset: "medium",
      pixelFormat: "yuv420p",
    });
  });

  it("high uses h265, crf 16, slow, 10-bit", () => {
    expect(EXPORT_PRESETS.high).toEqual({
      codec: "h265",
      crf: 16,
      encodePreset: "slow",
      pixelFormat: "yuv420p10le",
    });
  });

  it("max uses prores, no crf, 10-bit 422", () => {
    expect(EXPORT_PRESETS.max).toEqual({
      codec: "prores",
      crf: 0,
      encodePreset: "medium",
      pixelFormat: "yuv422p10le",
    });
  });
});

describe("resolveExportPreset", () => {
  it("returns preset values with no overrides", () => {
    const result = resolveExportPreset("low", {});
    expect(result.codec).toBe("h264");
    expect(result.crf).toBe(23);
    expect(result.encodePreset).toBe("fast");
    expect(result.pixelFormat).toBe("yuv420p");
  });

  it("individual overrides win over preset", () => {
    const result = resolveExportPreset("high", { codec: "h264", crf: 20 });
    expect(result.codec).toBe("h264");
    expect(result.crf).toBe(20);
    expect(result.encodePreset).toBe("slow");
    expect(result.pixelFormat).toBe("yuv420p10le");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/__tests__/export-presets.test.ts`
Expected: FAIL — `resolveExportPreset` and `EXPORT_PRESETS` not found

- [ ] **Step 3: Add `ExportPreset` and `PixelFormat` types**

Add to `packages/core/src/types.ts`:

```typescript
export type ExportPreset = "low" | "medium" | "high" | "max";
export type PixelFormat = "yuv420p" | "yuv420p10le" | "yuv422p10le";
```

- [ ] **Step 4: Create `export-presets.ts` with data and resolver**

Create `packages/core/src/export-presets.ts`:

```typescript
import type { ExportPreset, OutputCodec, PixelFormat } from "./types";

export interface ExportPresetSettings {
  codec: OutputCodec;
  crf: number;
  encodePreset: "fast" | "medium" | "slow";
  pixelFormat: PixelFormat;
}

export const EXPORT_PRESETS: Record<ExportPreset, ExportPresetSettings> = {
  low: { codec: "h264", crf: 23, encodePreset: "fast", pixelFormat: "yuv420p" },
  medium: { codec: "h264", crf: 18, encodePreset: "medium", pixelFormat: "yuv420p" },
  high: { codec: "h265", crf: 16, encodePreset: "slow", pixelFormat: "yuv420p10le" },
  max: { codec: "prores", crf: 0, encodePreset: "medium", pixelFormat: "yuv422p10le" },
};

interface ExportOverrides {
  codec?: OutputCodec;
  crf?: number;
  encodePreset?: "fast" | "medium" | "slow";
}

export function resolveExportPreset(
  preset: ExportPreset,
  overrides: ExportOverrides,
): ExportPresetSettings {
  const base = EXPORT_PRESETS[preset];
  return {
    codec: overrides.codec ?? base.codec,
    crf: overrides.crf ?? base.crf,
    encodePreset: overrides.encodePreset ?? base.encodePreset,
    pixelFormat: base.pixelFormat,
  };
}
```

- [ ] **Step 5: Export from core index**

Add to `packages/core/src/index.ts`:

```typescript
export type { ExportPresetSettings } from "./export-presets";
export { EXPORT_PRESETS, resolveExportPreset } from "./export-presets";
```

Also export the new types from `types.ts`:

```typescript
export type {
  // ...existing exports...
  ExportPreset, PixelFormat,
} from "./types";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/core/__tests__/export-presets.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/export-presets.ts packages/core/src/index.ts packages/core/__tests__/export-presets.test.ts
git commit -m "feat(core): add export preset types and resolver"
```

---

### Task 2: Add `pixelFormat` to encoder settings in pipeline

**Files:**
- Modify: `packages/cli/src/pipeline.ts:7-11,42-96`

- [ ] **Step 1: Add `pixelFormat` to `EncoderSettings` interface**

In `packages/cli/src/pipeline.ts`, update the interface:

```typescript
interface EncoderSettings {
  codec: OutputCodec;
  crf: number;
  encodePreset: string;
  pixelFormat: string;
}
```

- [ ] **Step 2: Use `pixelFormat` from settings instead of hardcoding**

In `buildEncoderArgs`, replace the hardcoded `format=yuv420p` with `settings.pixelFormat`. Update the `bt709Filter` line:

```typescript
const bt709Filter = `scale=in_range=full:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=${settings.pixelFormat}`;
```

For the prores case, replace `format=yuv422p10le` similarly:

```typescript
case "prores":
  base.push(
    "-vf", `scale=in_range=full:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=${settings.pixelFormat}`,
    "-c:v", "prores_ks", "-profile:v", "3",
    ...bt709Tags,
  );
  break;
```

- [ ] **Step 3: Update the default settings fallback**

Update line 123 where the default settings are created:

```typescript
const settings = encoderSettings ?? { codec: "h264", crf: 18, encodePreset: "medium", pixelFormat: "yuv420p" };
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `bun test`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/pipeline.ts
git commit -m "feat(cli): make pixel format configurable in encoder settings"
```

---

### Task 3: Add `--export` flag to CLI arg parsing

**Files:**
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/__tests__/cli.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/cli/__tests__/cli.test.ts`:

```typescript
it("parses --export low", () => {
  const result = parseArgs(["input.mp4", "--export", "low"]);
  expect(result.codec).toBe("h264");
  expect(result.crf).toBe(23);
  expect(result.encodePreset).toBe("fast");
});

it("parses --export high", () => {
  const result = parseArgs(["input.mp4", "--export", "high"]);
  expect(result.codec).toBe("h265");
  expect(result.crf).toBe(16);
  expect(result.encodePreset).toBe("slow");
});

it("--export with individual override: codec wins", () => {
  const result = parseArgs(["input.mp4", "--export", "high", "--codec", "h264"]);
  expect(result.codec).toBe("h264");
  expect(result.crf).toBe(16);
  expect(result.encodePreset).toBe("slow");
});

it("--export with individual override: crf wins", () => {
  const result = parseArgs(["input.mp4", "--export", "high", "--crf", "20"]);
  expect(result.crf).toBe(20);
});

it("throws on invalid --export value", () => {
  expect(() => parseArgs(["input.mp4", "--export", "ultra"])).toThrow();
});

it("--export max throws on non-macOS", () => {
  // This test only runs on non-macOS; skip on macOS
  if (process.platform === "darwin") return;
  expect(() => parseArgs(["input.mp4", "--export", "max"])).toThrow(/macOS/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/cli/__tests__/cli.test.ts`
Expected: FAIL — `--export` is unknown flag

- [ ] **Step 3: Add `--export` to known flags, help text, and parsing**

In `packages/cli/src/cli.ts`:

Add to `HELP_TEXT` after the `--blend` line:

```
  --export     <preset>     Export quality: low/medium/high/max (default: none)
```

Add `"--export"` to the `KNOWN_FLAGS` set.

Add the import at the top:

```typescript
import { resolveExportPreset } from "@hance/core";
import type { ExportPreset } from "@hance/core";
```

In `parseArgs`, add a variable after `const overrides`:

```typescript
let exportPreset: ExportPreset | undefined;
```

Add a case in the switch statement for flag parsing (in the non-boolean flags section):

```typescript
case "--export":
  if (val !== "low" && val !== "medium" && val !== "high" && val !== "max") {
    throw new Error(`--export must be low, medium, high, or max, got ${val}`);
  }
  if (val === "max" && process.platform !== "darwin") {
    throw new Error("ProRes export is only available on macOS. Use --codec prores for cross-platform ProRes via prores_ks.");
  }
  exportPreset = val; break;
```

After `const effectOpts = applyPreset(presetName, overrides);`, resolve the export preset if set:

```typescript
let resolvedCodec = effectOpts.codec;
let resolvedCrf = effectOpts.crf;
let resolvedEncodePreset = effectOpts.encodePreset;
let resolvedPixelFormat = "yuv420p";

if (exportPreset) {
  const exportSettings = resolveExportPreset(exportPreset, {
    codec: overrides["codec"] as OutputCodec | undefined,
    crf: overrides["crf"] as number | undefined,
    encodePreset: overrides["encode-preset"] as "fast" | "medium" | "slow" | undefined,
  });
  resolvedCodec = exportSettings.codec;
  resolvedCrf = exportSettings.crf;
  resolvedEncodePreset = exportSettings.encodePreset;
  resolvedPixelFormat = exportSettings.pixelFormat;

  if (exportPreset === "high") {
    console.error("High quality export — expect larger file sizes");
  }
}
```

Update the return statement to use resolved values:

```typescript
return {
  input,
  output,
  encodePreset: resolvedEncodePreset,
  codec: resolvedCodec,
  crf: resolvedCrf,
  blend: effectOpts.blend,
  pixelFormat: resolvedPixelFormat,
  // ...rest unchanged
};
```

Add `pixelFormat: string;` to the `ParsedArgs` interface (via `FilmOptions` or directly).

- [ ] **Step 4: Add `pixelFormat` to `FilmOptions` type**

In `packages/core/src/types.ts`, add to `FilmOptions`:

```typescript
export interface FilmOptions {
  // ...existing fields...
  pixelFormat: PixelFormat;
}
```

- [ ] **Step 5: Update `applyPreset` to return a default `pixelFormat`**

In `packages/core/src/presets.ts`, add `pixelFormat` to the return:

```typescript
const pixelFormat = "yuv420p";
return { encodePreset, codec, crf, blend, pixelFormat, colorSettings, halation, aberration, bloom, grain, vignette, splitTone, cameraShake, mergedParams: merged };
```

Update the `EffectOptions` interface to include `pixelFormat: string;`.

- [ ] **Step 6: Pass `pixelFormat` through to pipeline**

In `packages/cli/src/cli.ts`, update the `runGpuExport` call to include `pixelFormat`:

```typescript
await runGpuExport(parsed.input, parsed.output, parsed.params, probeResult, (ratio) => {
  const pct = Math.round(ratio * 100);
  process.stdout.write(`\rProcessing... ${pct}%`);
}, { codec: parsed.codec, crf: parsed.crf, encodePreset: parsed.encodePreset, pixelFormat: parsed.pixelFormat });
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun test packages/cli/__tests__/cli.test.ts`
Expected: All PASS

- [ ] **Step 8: Run full test suite**

Run: `bun test`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/presets.ts packages/core/src/index.ts packages/cli/src/cli.ts packages/cli/__tests__/cli.test.ts
git commit -m "feat(cli): add --export flag with quality presets"
```
