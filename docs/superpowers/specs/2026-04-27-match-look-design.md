---
title: Match-look — image-driven preset creation
date: 2026-04-27
status: draft
---

# Match-look: image-driven preset creation

## Goal

Let an agent (Claude in a CLI session) take a reference image from the user and iteratively produce a Hance preset that makes the user's target media look like that reference. The agent drives the loop using new CLI primitives; Hance stays a renderer.

User flow: user shares a reference image and says "make my video look like this." Agent renders a preview frame, compares to the reference, adjusts settings, re-previews, and on convergence saves a named preset the user can reuse.

## Non-goals

- No new ML, color-stats solver, or built-in `hance match` command. Intelligence lives in the agent.
- No full-video rendering during the loop — single frames only.
- No new effects or grading knobs. The existing parameter set is the design surface.

## Scope split

This design covers two coordinated changes:

1. **CLI primitives** — two new subcommands (`hance preview`, `hance preset`) plus a small subcommand dispatcher refactor.
2. **Skill** — a `/match-look` skill that encodes the iteration loop and guardrails.

Broader CLI hygiene (clig.dev compliance) is tracked separately in `2026-04-27-cli-hygiene-backlog.md`. Only the subcommand dispatcher from that backlog is required here; the rest is deferred.

## CLI changes

### Subcommand dispatcher

`isSubcommand` in `packages/cli/src/cli.ts` is hardcoded to `ui`. Replace with a dispatcher table:

| argv[0]   | Behavior                              |
|-----------|---------------------------------------|
| `ui`      | Existing UI server (unchanged)        |
| `preview` | New: stitched-frame render            |
| `preset`  | New: `save <name>` and `list`         |
| anything else | Treat as input path — existing render path |

Each subcommand owns its own help text (`hance preview --help`, `hance preset --help`) and its own flag whitelist. Effect flags (`--exposure`, `--contrast`, etc.) are parsed by a shared parser used by `render`, `preview`, and `preset save` — same names, ranges, validation. No drift between commands.

### `hance preview`

```
hance preview <input> -o <out.png> [effect flags…]
```

- **Image input:** decode → run once through the Rust `wgpu` sidecar (same path as today's image render) → encode PNG.
- **Video input:** probe duration, seek to 25%/50%/75% via FFmpeg (`-ss <t> -i <input> -frames:v 1 -f rawvideo -pix_fmt rgba`), feed each raw frame through the same sidecar with the same params, stitch the three rendered frames horizontally, encode PNG. Sidecar should be reused across the three frames if the binding supports it.
- **Output:** PNG written to `-o <path>`. On success, print the absolute output path to stdout — nothing else — and exit 0. Errors and progress go to stderr. This clean-stdout contract lets the skill capture the path with one line.
- **Performance target:** under 1.5s for a 1080p video on a typical Mac. If we miss this, fall back to a single frame at 50% and revisit.

### `hance preset save`

```
hance preset save <name> [effect flags…] [--force]
```

- Parses the same effect flags as `render` and `preview`.
- Writes `~/.hance/presets/<name>.hlook` (matches existing `loadPreset` lookup at `packages/core/src/presets.ts:30-50`).
- Validates `<name>`: no path separators, no leading dot, no whitespace. Refuses to overwrite an existing file without `--force`.
- Prints the saved path to stdout, exit 0.

### `hance preset list`

```
hance preset list
```

- Lists `.hlook` and `.json` files in `~/.hance/presets/` and the builtin presets dir, one name per line on stdout. Used by the skill to check whether a name is taken before saving.

## Skill: `/match-look`

A new skill at the project's skill location (TBD by where existing skills live; check `.claude/` or repo root) that encodes the iteration loop.

### Inputs

- Reference image attached to the conversation (the look to match).
- Target file path (video or image) the user wants graded.

### Loop

1. **Baseline preview** — `hance preview <target> -o /tmp/hance-match-<pid>/iter-0.png` with no effect flags. Anchors what "before" looks like.
2. **Compare** — agent looks at reference vs. baseline and identifies gaps in this fixed priority order. Earlier knobs dominate; do not chase later ones before earlier ones are right:
   1. White balance (`--white-balance`, `--tint`)
   2. Exposure (`--exposure`)
   3. Contrast (`--contrast`, `--highlights`, `--fade`)
   4. Saturation / richness (`--subtractive-sat`, `--richness`, `--bleach-bypass`)
   5. Split-tone (`--split-tone-*`)
   6. Halation (`--halation-*`)
   7. Grain (`--grain-*`)
   8. Vignette (`--vignette-*`)
3. **Render iteration N** — `hance preview <target> -o /tmp/hance-match-<pid>/iter-N.png <flags>`.
4. **Judge** — agent compares iter-N to the reference. If close enough, stop. Otherwise adjust one or two knobs and return to step 3.
5. **Stop conditions:**
   - Match is close enough (agent's judgment).
   - Hard cap: 5 iterations.
   - Two consecutive iterations show no improvement.
6. **Confirm with user** — show the final preview path and the chosen settings, ask whether to save.
7. **Save** — `hance preset save <name>` with the agreed settings. Tell the user the load command: `hance <input> -o out.mp4 --preset <name>`.
8. **Cleanup** — `rm -rf /tmp/hance-match-<pid>/` on success, on user-cancel, and on error.

### Guardrails encoded in the skill

- Never run `hance <input>` (the render path) during the loop — only `hance preview`. Rendering full video is expensive and wrong here.
- Never invent flags. Only use names that appear in `hance preview --help`.
- Don't tweak grain/halation/vignette before exposure and white balance are right.
- Don't save the preset until the user confirms.
- Always clean up the iteration directory.

## Testing

### Unit tests (`packages/cli/__tests__/`)

- Subcommand dispatcher routes `preview`, `preset save`, `preset list`, and falls through to render for unknown first args.
- `preset save` writes valid `.hlook` JSON, refuses overwrite without `--force`, rejects names with path separators / leading dots / whitespace.
- Shared effect-flag parser produces identical params for `render`, `preview`, and `preset save` given the same flags.

### E2E tests (`packages/cli/__tests__/e2e/`)

- `hance preview <test.jpg> -o out.png` produces a valid PNG.
- `hance preview <test.mp4> -o out.png` produces a PNG roughly 3× wider than tall (the contact sheet).
- `hance preset save test-look --exposure 0.5` followed by `hance <test.jpg> -o out.png --preset test-look` produces the same image as `hance <test.jpg> -o out.png --exposure 0.5`.
- Stdout-on-success contract: `hance preview` and `hance preset save` print only the output path on stdout — no progress, no logs.

### Skill verification (manual, one-time)

Run `/match-look` end-to-end against two or three reference stills and confirm convergence in ≤5 iterations.

## Open questions

None blocking. The skill location (`.claude/skills/` vs. another path) will be determined by checking where existing skills live in the repo during implementation.
