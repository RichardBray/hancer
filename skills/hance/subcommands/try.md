# /hance try

The exploratory entry point. Generate 3 candidate looks for one image or video, render previews, and open the `/compare` page so the user can pick one and edit it.

## Args

`<file> [prompt | reference-image]`

- `<file>` — required. Image or video.
- Optional second arg:
  - A prompt (`"warm 70s portra"`) → look-matching against `presets/index.json`.
  - A path to a reference image → look-matching by visual analysis of the reference.
  - Omitted → pick 3 sensibly distinct presets (different families, e.g. one warm portrait, one cool tungsten, one B&W).

## What to do

1. **Pick 3 looks.**
   - Read `presets/index.json` (see `references/preset-index.md` for schema). For prompt or reference inputs, score entries against `keywords` + `characteristics` + `description` and pick the top matches.
   - If fewer than 3 strong matches exist, generate new `.hlook` files to fill the slate. Save them with `<runner> preset save <name> <flags>`. Saving rebuilds the preset index automatically.
2. **Render the variants.**
   - Make a temp dir: `WORK=$(mktemp -d -t hance-try)`.
   - For each of the 3 looks, render the file to `$WORK/v{1,2,3}.png` (image) or extract a still at t=1s for video. Use `<runner> preview <file> --preset <name> -o $WORK/v<N>.png`.
   - Also copy/symlink the original to `$WORK/original.<ext>` so the compare page can read it.
3. **Start the UI server** if one is not already running on port 4096 (default), then open the browser to:
   ```
   http://localhost:4096/compare?kind=image|video
     &original=<absolute-path>
     &v1=<abs>&v2=<abs>&v3=<abs>
     &v1Look=<abs-to-.hlook>&v2Look=<abs>&v3Look=<abs>
   ```
   See `references/compare-page.md` for the exact contract.
4. The user picks a variant in-browser. Clicking **Edit** seeds the editor with that look — you do not need to do anything else after opening the page.

## Hard rules

- Use `hance preview` (still) for rendering candidates. Never run a full video render here.
- Render at most 3 variants. More is overwhelming and slow.
- Do not block the terminal waiting on the user's pick — open the browser and stop.
- Any new `.hlook` you create must include `name`, `description`, `keywords`, and `characteristics` so the index entry is useful.
