# `/hance` skill — design

**Date:** 2026-05-01
**Status:** Approved (brainstorm), pending implementation plan
**Inspired by:** the `impeccable` skill structure

## Goal

A single Claude skill, `/hance`, exposing six subcommands that drive the Hancer CLI end-to-end: install, apply a known look, explore looks on a sample, batch-process, and open the editor. Replaces the current `skills/match-look` skill.

## Prerequisite (blocker)

The skill assumes `npx hance@latest` (or `bunx hance@latest`) works. **The `hance` npm package does not yet exist** — publishing it is a hard prerequisite before this skill can ship. The user has noted ongoing trouble with their npm account; resolving that and publishing v0.4.x to npm is blocker #1.

## Distribution model

Npx-by-default, bunx if available, binary-optional.

- **Runner selection (per invocation):**
  1. If `hance` is on `PATH` (binary installed) → use it. Fastest, offline-capable.
  2. Else if `bun` is on `PATH` → `bunx hance@latest <args>`.
  3. Else → `npx hance@latest <args>`. (Node is far more universally available than Bun, so npx is the safe default.)
- **No "you must run setup first" failure mode.** Every subcommand works on a fresh machine without `setup`.
- **No `update` subcommand and no auto-upgrade in `setup`.** The binary, once installed, is left alone. A future version of the `hance` CLI will check for new releases on its own; that work is out of scope for this skill.

## Subcommands (5 + setup = 6 total)

| Cmd | Args | Purpose |
|---|---|---|
| `setup` | — | Optional: install the compiled binary for faster/offline runs. Install-only (no upgrade behavior). |
| `run` | `<preset> <file>` **or** `<file> <preset>` (order-agnostic) | Apply a known preset to one file. |
| `try` | `<file> [prompt \| reference-image]` | Generate 3 variant looks for one image/video, open browser picker, allow Edit-in-UI. |
| `batch` | `<preset> <dir-or-glob>` | Apply one preset to many files (mixed images + videos). User must know the preset. |
| `ui` | `[file]` | Open the Hance editor, optionally seeded with a file. |

### `setup`

- Calls a new `scripts/install-agent.sh` (the existing `scripts/install.sh` is left untouched for human curl-from-README users).
- The agent-friendly script must:
  - Print terse, line-per-step progress (no spinners, no large ASCII).
  - Print an explicit "Windows is not currently supported" notice and exit cleanly on Windows detection.
  - On success, print 2–3 example invocations the user can paste next.
- `setup` is install-only. It does not check for or apply upgrades. Re-running on an already-installed system is a no-op (or a friendly "already installed at vX.Y.Z" message). A future Hance CLI release will handle self-update checks; that is out of scope here.

### `run`

- Detects which arg is the file (file-existence / extension check); the other is the preset.
- Pure pass-through to `hance <file> --preset <preset>`.

### `try`

The exploratory entry point. Subsumes the previous `look` subcommand.

1. **Pick 3 candidate looks.**
   - If a prompt or reference image was given: use look-logic — read `presets/index.json`, find good matches; if no good match exists, generate new `.hlook`(s) to fill in.
   - If no prompt: pick 3 sensible variants from the existing presets (e.g. distinct families).
2. **Render the variants** of `<file>` (still frame for video, full image for images) to a temp dir.
3. **Open the browser** to the new `/compare` route in `packages/ui` with query params for original + 3 variant paths and `kind=image|video`.
4. The `/compare` page shows a 2×2 grid (original + 3 variants). Each variant has an **Edit** button that opens the editor route seeded with that look.

New `.hlook` files created by `try` are written to `presets/` and trigger an index rebuild.

### `batch`

- Requires an explicit preset (no interactive prompting, no auto-detection).
- Accepts a directory or glob; processes all images and videos found.

### `ui`

- Launches the existing UI server and opens the browser.
- Optional file arg seeds the editor.

## Preset index

`presets/index.json` is the canonical, fast lookup for `try`'s look-matching.

**Schema (one entry per `.hlook`):**
```json
{
  "name": "Portra 400",
  "description": "Kodak Portra 400 — warm, low-contrast portrait film...",
  "keywords": ["portra", "kodak", "portrait", "warm", "soft"],
  "characteristics": ["warm skin tones", "low contrast", "fine grain", "natural"],
  "path": "presets/portra-400.hlook"
}
```

**Maintenance:** rebuilt whenever a `.hlook` is created or its metadata changes. Implementation choice (post-write hook in core vs. lazy rebuild at top of `try`) is deferred to the implementation plan, but the index file itself is part of the contract.

## `/compare` page

A new route in `packages/ui`, sharing the existing Tailwind setup, components, and font.

**Query-param contract:**
```
/compare?kind=image|video&original=<path>&v1=<path>&v2=<path>&v3=<path>&v1Look=<hlook-path>&v2Look=...&v3Look=...
```

**Behavior:**
- 2×2 grid: original (top-left), v1, v2, v3.
- Each variant cell has an **Edit** button. Clicking it navigates to the editor route, seeded with the corresponding `.hlook`.
- Same styling system as the editor — no duplicated CSS.

## Skill structure

```
skills/hance/
  SKILL.md
  subcommands/
    setup.md
    run.md
    try.md
    batch.md
    ui.md
  references/
    preset-index.md      # index.json schema + when/how to rebuild
    compare-page.md      # /compare query-param contract + Edit hand-off
```

`SKILL.md` is the always-loaded entry point and routes to per-subcommand docs in `subcommands/`. `references/` holds shared technical contracts that multiple subcommands need.

## Replaces

- `skills/match-look/` — deleted; its purpose is now served by `try`'s look-matching logic.

## Out of scope (intentional)

- Separate `update` subcommand. Npx/bunx are always-fresh; binary self-update will be handled by a future Hance CLI release, not by this skill.
- Splitting `try` into prompt-only vs. image-only variants.
- A composite preview image (the agent never sees previews; the user does, in-browser).
- Interactive preset prompting in `batch`.
- Windows support.
- Replacing the existing `scripts/install.sh`.

## Open implementation questions (for the plan, not this spec)

- Where does the index rebuild hook live — in the CLI's `.hlook` writer, or in the skill?
- How are the 3 `try` candidates rendered when the input is a video — single still at t=1s, or configurable?
- Does `try` reuse the running UI dev server if one is already up, or always start its own?
