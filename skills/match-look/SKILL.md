---
name: match-look
description: Iteratively dial in a Hance preset that matches a reference image. Use when the user shares a reference image and asks to make their video or image look like it.
---

# /match-look

You are tuning a Hance preset so the user's target media matches a reference image they shared.

## Inputs

- **Reference image**: attached to the conversation. This is the look to match.
- **Target file**: a video or image path the user wants graded. Ask if not provided.

## Loop

Use a per-run scratch dir: `WORK=/tmp/hance-match-$$` and `mkdir -p "$WORK"`.

1. **Baseline.** Run `hance preview <target> -o "$WORK/iter-0.png"` with no effect flags. Look at the output — this is "before".

2. **Compare** reference vs. current preview. Identify gaps in this fixed priority order. Earlier knobs dominate; do not chase later ones before earlier ones are right:
   1. White balance — `--white-balance` (Kelvin, 1000–15000), `--tint` (-100..100)
   2. Exposure — `--exposure` (-2..2)
   3. Contrast — `--contrast` (0..3), `--highlights` (-1..1), `--fade` (0..1)
   4. Saturation / richness — `--subtractive-sat` (0..3), `--richness` (0..3), `--bleach-bypass` (0..1)
   5. Split-tone — `--split-tone-mode`, `--split-tone-amount`, `--split-tone-hue`, `--split-tone-pivot`
   6. Halation — `--halation-amount`, `--halation-radius`, `--halation-saturation`, `--halation-hue`
   7. Grain — `--grain-amount`, `--grain-size`, `--grain-softness`, `--grain-saturation`, `--grain-defocus`
   8. Vignette — `--vignette-amount`, `--vignette-size`

3. **Render iteration N.** Run `hance preview <target> -o "$WORK/iter-N.png" <flags>`. Adjust one or two knobs at a time so you can attribute changes.

4. **Judge.** Look at iter-N vs. reference.

5. **Stop when any of:**
   - You judge the match close enough.
   - 5 iterations have run.
   - Two consecutive iterations show no improvement.

6. **Confirm.** Show the user the final preview path and the chosen flags. Ask whether to save and what name to use.

7. **Save.** Run `hance preset save <name> <flags>`. If the name is taken (`hance preset list` to check, or non-zero exit on save), ask the user before passing `--force`. Then tell them: `hance <input> -o out.mp4 --preset <name>`.

8. **Cleanup.** `rm -rf "$WORK"` on success, on user-cancel, and on error.

## Guardrails

- **Never run `hance <input>`** (the render path) during the loop. Only `hance preview`. Full video renders are expensive and wrong here.
- **Never invent flags.** Only use names listed in `hance preview --help`.
- **Don't tweak grain/halation/vignette before exposure and white balance are right.** Priority order is not optional.
- **Don't save the preset until the user confirms.**
- **Always clean up `$WORK`** — even on error or cancel.
