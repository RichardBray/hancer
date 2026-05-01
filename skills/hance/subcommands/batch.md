# /hance batch

Apply one preset to many files.

## Args

`<preset> <dir-or-glob>`

- `<preset>` — required, must be a known preset name. Validate with `<runner> preset list` if unsure.
- `<dir-or-glob>` — directory (recursed one level) or shell glob.

## What to do

1. Resolve the inputs into a concrete file list. Accept extensions: `.mp4 .mov .mkv .webm .avi .png .jpg .jpeg .webp .tif .tiff .heic`.
2. Confirm the count and the output directory with the user before starting. Default output dir: `<input-dir>/_hance/` mirroring the input names.
3. Loop sequentially:
   ```sh
   <runner> <file> --preset <preset> -o <out>
   ```
4. Print a one-line summary per file (ok / failed) and a final tally.

## Hard rules

- Preset is required. Do not prompt interactively for it inside the loop, and do not auto-detect.
- Process files sequentially — Hance already pegs the GPU; parallel runs make it slower, not faster.
- Skip (do not overwrite) existing outputs unless the user asked for `--force` semantics.
- Stop the batch on the first failure and report which file failed; do not silently continue.
