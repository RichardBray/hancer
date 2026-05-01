# /hance setup

Get the user ready to run Hance. There is no compiled-binary install path — every Hance invocation goes through `bunx hance@latest` (or `npx hance@latest` if Bun is unavailable). This subcommand just verifies prerequisites and shows the user some example commands.

## When to use

The user explicitly asks to "install hance" or "set up hance", or is running Hance for the first time and wants to confirm their environment is ready.

## What to do

1. **Platform check.** Run `uname -s`. If it reports Windows (`MINGW*`, `MSYS*`, `CYGWIN*`), stop and tell the user:
   > Hance does not currently support Windows. macOS and Linux only. WSL2 (Linux subsystem) works.

2. **Bun check.** Run `command -v bun`. If missing, recommend installing it:
   ```sh
   curl -fsSL https://bun.sh/install | bash
   ```
   Bun is the preferred runner — it's faster than `npx` and handles the cold-start better. If the user refuses Bun, `npx hance@latest` is the fallback (no extra setup needed beyond a working Node.js).

3. **ffmpeg check.** Run `command -v ffmpeg`. If missing, offer to install it (always confirm before running `sudo`):
   - macOS: `brew install ffmpeg` (only if `command -v brew` succeeds; otherwise tell them to install Homebrew first).
   - Linux: detect the package manager and propose:
     - `apt` → `sudo apt-get update && sudo apt-get install -y ffmpeg`
     - `dnf` → `sudo dnf install -y ffmpeg`
     - `pacman` → `sudo pacman -S --noconfirm ffmpeg`
     - `zypper` → `sudo zypper install -y ffmpeg`
     - `apk` → `sudo apk add ffmpeg`
   - If no package manager is recognized, just print the requirement and stop.

4. **Show the user what they can do.** Print a short list of example invocations so they have something concrete to try next. Pick whichever runner is available — `bunx` if Bun is installed, otherwise `npx`:

   ```sh
   # Show help / list presets
   bunx hance@latest --help
   bunx hance@latest preset list

   # Apply a preset to one file
   bunx hance@latest input.jpg -o out.jpg --preset portra-400
   bunx hance@latest input.mp4 -o out.mp4 --preset cinestill-800t

   # Open the editor (UI)
   bunx hance@latest ui

   # Explore looks for a reference (uses /hance try)
   #   "make this look like portra"
   #   "show me 3 looks for this image"
   ```

   Tell the user that on first run, `bunx` will fetch the package once and cache it; subsequent runs are fast.

## Hard rules

- Do **not** suggest a binary install or a curl-from-GitHub installer. There is no longer one.
- Do **not** offer to "upgrade" Hance — `bunx hance@latest` always pulls the latest version on its own.
- Do **not** install Bun or ffmpeg without confirming with the user first.
