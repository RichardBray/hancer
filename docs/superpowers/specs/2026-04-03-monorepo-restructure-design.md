# Monorepo Restructure Design

Pure restructure of the flat `src/` layout into Bun workspaces. No behavior changes, no new features.

## Target Structure

```
hance/
├── packages/
│   ├── core/                  # @hance/core — shared definitions
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── schema.ts
│   │   │   ├── presets.ts
│   │   │   ├── probe.ts
│   │   │   └── index.ts       # barrel export
│   │   ├── shaders/
│   │   │   └── *.wgsl         # 10 shared WGSL shaders
│   │   └── package.json
│   │
│   ├── cli/                   # @hance/cli — CLI binary
│   │   ├── src/
│   │   │   ├── cli.ts         # entry point
│   │   │   ├── pipeline.ts
│   │   │   ├── progress.ts
│   │   │   └── gpu/           # wgpu-renderer.ts
│   │   ├── __tests__/
│   │   │   ├── cli.test.ts
│   │   │   ├── progress.test.ts
│   │   │   ├── gpu/
│   │   │   └── e2e/
│   │   └── package.json
│   │
│   ├── ui/                    # @hance/ui — Bun server + React client
│   │   ├── server.ts
│   │   ├── app/               # React app, components, hooks, gpu
│   │   ├── dist/
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   └── wgpu/                  # Rust wgpu renderer
│       ├── src/
│       ├── Cargo.toml
│       └── Cargo.lock
│
├── apps/
│   └── desktop/               # placeholder (empty)
│
├── package.json               # root — workspaces, build scripts
├── tsconfig.json              # base config
└── bunfig.toml
```

## Package Dependencies

```
@hance/core  → (no dependencies)
@hance/cli   → @hance/core
@hance/ui    → @hance/core, @hance/cli
```

- `@hance/ui` depends on `@hance/cli` for the `runGpuExport` function used in `server.ts` for video export.
- `wgpu` is a Cargo project, not a Bun workspace member. It references shaders from `../../core/shaders/` via `include_str!`.

## What Goes Where

### @hance/core
- `types.ts` — all shared interfaces (FilmOptions, ProbeResult, etc.)
- `schema.ts` — effect schema definition
- `presets.ts` — preset loading, listing, directory resolution
- `probe.ts` — ffprobe wrapper and output parsing
- `shaders/*.wgsl` — all 10 WGSL shader files (shared by UI and wgpu)
- `index.ts` — barrel export for all of the above

### @hance/cli
- `cli.ts` — CLI entry point, arg parsing
- `pipeline.ts` — FFmpeg GPU export orchestration
- `progress.ts` — FFmpeg progress parsing
- `gpu/` — wgpu-renderer.ts (headless renderer interface)

### @hance/ui
- `server.ts` — Bun HTTP server (preset API, schema API, video export, static serving)
- `app/` — React SPA (App.tsx, components, hooks, gpu, mediaSizing.ts)
- `dist/` — built static assets

## Import Rewiring

After the move, imports change from relative paths to workspace packages:

| Before | After |
|--------|-------|
| `../types` | `@hance/core` |
| `../schema` | `@hance/core` |
| `../presets` | `@hance/core` |
| `../probe` | `@hance/core` |
| `../pipeline` | `@hance/cli` |

## Workspace Config

**Root `package.json`:**
- `"workspaces": ["packages/core", "packages/cli", "packages/ui"]`
- Build scripts: `build:core` → `build:gpu` → `build:ui` → `build:cli`
- Only `@types/bun` at root devDependencies
- React/React-DOM move to `@hance/ui`

**Each package** gets its own `tsconfig.json` extending a root base config.

**wgpu** builds via `cargo build --release` inside `packages/wgpu/`, triggered by root `build:gpu`.

## Test Distribution

| Test file | Package |
|-----------|---------|
| `cli.test.ts` | `@hance/cli` |
| `progress.test.ts` | `@hance/cli` |
| `schema.test.ts` | `@hance/core` |
| `presets.test.ts` | `@hance/core` |
| `probe.test.ts` | `@hance/core` |
| `e2e/` | `@hance/cli` |
| `gpu/` tests | `@hance/cli` |
| `ui/` tests | `@hance/ui` |

`bun test` at root runs all packages. Each package can run tests independently.

## Migration Steps

1. Create directory structure
2. Move files to new locations
3. Create per-package `package.json` with names and dependencies
4. Set up Bun workspaces in root `package.json`
5. Create base + per-package `tsconfig.json`
6. Rewrite all imports to use `@hance/core` and `@hance/cli`
7. Update wgpu `include_str!` paths for shaders
8. Update root build scripts
9. Run all tests — must pass identically
10. Create `apps/desktop/` placeholder

## Constraints

- No behavior changes — every function stays identical
- No new features or refactoring of function signatures
- Rename sidecar → wgpu as part of this restructure
- All existing tests must pass after restructure
