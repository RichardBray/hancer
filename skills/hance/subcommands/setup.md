# /hance setup

Install the compiled `hance` binary for faster, offline-capable runs. Optional — every other subcommand works without it via `bunx`/`npx`.

## When to use

The user explicitly asks to install Hance, or has asked for repeated runs and you want to avoid the npx cold-start each time.

## What to do

1. Confirm the user is on macOS or Linux (`uname -s`). If Windows, stop and tell them Hance does not currently support Windows.
2. Run the agent-friendly installer:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/Orva-Studio/hancer/main/scripts/install-agent.sh | sh
   ```
3. The installer is **install-only**. If it reports "already installed", do nothing — there is no upgrade path here. A future Hance CLI release will handle self-update; do not try to force a reinstall.
4. **ffmpeg check.** The installer only warns if ffmpeg is missing (it does not install it). If the output contains `ffmpeg missing`, offer to install it for the user:
   - macOS: `brew install ffmpeg` (only if `command -v brew` succeeds; otherwise tell them to install Homebrew first).
   - Linux: detect the package manager and propose the matching command:
     - `apt` → `sudo apt-get update && sudo apt-get install -y ffmpeg`
     - `dnf` → `sudo dnf install -y ffmpeg`
     - `pacman` → `sudo pacman -S --noconfirm ffmpeg`
     - `zypper` → `sudo zypper install -y ffmpeg`
     - `apk` → `sudo apk add ffmpeg`
   - Always confirm with the user before running a `sudo` command. If no package manager is recognized, just print the requirement and stop.
5. On success, surface the printed example invocations to the user verbatim. The default install dir is `~/.hance/bin`. If that is not on `PATH`, tell the user to add it.

## Hard rules

- Do not run `scripts/install.sh` (the human-facing curl-from-README installer). Use `install-agent.sh`.
- Do not pass `--version` unless the user asked for a specific version.
- Do not "upgrade" by deleting the binary and reinstalling. That is out of scope for this skill.
