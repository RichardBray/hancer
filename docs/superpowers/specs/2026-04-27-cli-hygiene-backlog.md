---
title: CLI hygiene backlog (clig.dev compliance)
date: 2026-04-27
status: backlog
---

# CLI hygiene backlog

Issues found auditing `packages/cli/src/cli.ts` against [clig.dev](https://clig.dev/). Tracked separately from the look-match feature; pull from this list as time allows.

## Must-fix before adding new subcommands

These block clean addition of `hance preview` and `hance preset`:

- **Subcommand dispatcher.** `isSubcommand` (cli.ts:110) hardcodes `ui`. Replace with a real dispatcher so `hance preview --help` and `hance preset --help` work, and so future subcommands don't require touching this function.

## Real bugs

- **`--version` not in `KNOWN_FLAGS`.** `hance input.mp4 --version` throws "Unknown flag." Top-level shortcut at cli.ts:333 only catches it when nothing else is parsed.
- **`-v` collision.** `-v` is conventionally `--verbose`. Drop the `-v` shortcut for `--version`; long form is sufficient.
- **`--export` is documented but unwired.** Listed in HELP_TEXT (cli.ts:19) but missing from `KNOWN_FLAGS` (cli.ts:86) and the parse switch. Either wire it up or remove from help.
- **Progress writes to stdout.** cli.ts:409, 445–447 use `process.stdout.write` for progress. Progress is messaging — should go to stderr so stdout stays clean for piping.
- **No TTY detection on progress bar.** `\r`-based progress garbles non-TTY output (CI logs, piped). Fall back to plain `"Processing... 50%\n"` lines when `!process.stdout.isTTY`.

## Nice-to-have

- **No-args prints help, not error.** clig.dev: concise help on no args. Currently throws "No input file provided."
- **`--quiet` / `-q` flag.** Suppress non-essential output.
- **Did-you-mean on unknown flags.** Levenshtein suggestion in the error.
- **`NO_COLOR` env var.** Latent (no color today); honor it when color is added.

## Explicitly skipped (YAGNI for this tool)

- `--json` structured output — nothing here is structured data.
- Pager support — no long text output.
- `--no-input` / interactivity flags — no prompts today.
- XDG Base Directory migration — `~/.hance/` is fine; not blocking.
