# /hance run

Apply a single known preset to a single file. Pure pass-through to the CLI.

## Args

`<preset> <file>` or `<file> <preset>` — order-agnostic. Detect which arg is the file:

- The file arg either exists on disk, or has a media extension (`.mp4`, `.mov`, `.mkv`, `.webm`, `.avi`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.tif`, `.tiff`, `.heic`).
- The other arg is the preset name.

If both args look like files, or neither, ask the user.

## What to do

1. Pick the runner per `SKILL.md` (binary > `bunx` > `npx`).
2. Default output path: same dir as input, with `_<preset>` appended before the extension. Confirm with the user before overwriting an existing file.
3. Run:
   ```sh
   <runner> <file> --preset <preset> -o <output>
   ```
4. Print the output path when done.

## Hard rules

- Do not pass any effect flags. `run` is preset-only — knob tuning belongs in `try` or the editor.
- Do not invent a preset. Validate against `<runner> preset list` if the user gives a name you do not recognize.
- Do not auto-select an output codec. The CLI's defaults are correct.
