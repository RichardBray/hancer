# /hance ui

Open the Hance editor in the browser.

## Args

`[file]` — optional. If given, the editor opens with that file pre-loaded.

## What to do

1. Pick the runner per `SKILL.md`.
2. Run:
   ```sh
   <runner> ui [file]
   ```
   The CLI starts the local server, opens the browser, and prints the URL.
3. Stop. The user drives from the browser.

## Hard rules

- Do not background the process and continue working — the user expects to see the editor and decide what to do next.
- Do not open the editor and immediately do something else with the file — `ui` is terminal for this turn.
