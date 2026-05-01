# Preset index

`presets/index.json` is the canonical, fast lookup for `try`'s look-matching. One entry per `.hlook`.

## Schema

```json
{
  "name": "Portra 400",
  "description": "Kodak Portra 400 — warm, low-contrast portrait film...",
  "keywords": ["portra", "kodak", "portrait", "warm", "soft"],
  "characteristics": ["warm skin tones", "low contrast", "fine grain", "natural"],
  "path": "presets/portra-400.hlook"
}
```

- `name` — display name (matches the `name` field inside the `.hlook`).
- `description` — one short sentence.
- `keywords` — terms the user is likely to type (film stocks, brands, moods).
- `characteristics` — visual descriptors used to score against a reference image.
- `path` — repo-relative for built-in presets, absolute for user presets in `~/.hance/presets/`.

## Maintenance

`presets/index.json` is a **generated artifact** and is gitignored. It is not committed to the repo. Two places produce it:

- **Repo (builtin-only):** `bun run scripts/build-preset-index.ts` writes `presets/index.json` from the `.hlook` files in `presets/`. Run this once after a fresh clone, or any time the builtin `.hlook`s change.
- **Runtime (merged builtin + user):** `rebuildPresetIndex()` in `core/preset-index.ts` writes `~/.hance/presets/index.json`. It's invoked automatically whenever a `.hlook` is created, edited, renamed, deleted, or imported. Hooks live in `packages/cli/src/commands/preset.ts` (CLI) and `packages/ui/server.ts` (UI server POST/PUT/DELETE/import handlers).

If `try` cannot find any index, build the repo one with the command above before continuing.

## How `try` uses the index

1. Read the merged index (prefer `~/.hance/presets/index.json` if it exists, otherwise fall back to the `presets/index.json` in the repo — building it via `scripts/build-preset-index.ts` first if missing).
2. For prompt input: tokenize the prompt, score entries by keyword/description overlap.
3. For reference-image input: describe the reference's color/contrast/grain qualities, score against `characteristics`.
4. Pick the top 3 distinct entries (avoid two near-duplicates from the same family). If fewer than 3 strong matches, generate new `.hlook`s to fill out the slate — saving them re-triggers the index rebuild.
