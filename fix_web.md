# Web Preview vs Export Findings

## Summary

The current web preview is not WYSIWYG relative to export.

- The browser preview uses a custom WebGPU renderer.
- Export uses the FFmpeg filter graph.
- Because those are separate implementations, visual drift is expected.

Based on the supplied comparisons:

- Bloom looks reasonably close.
- Split tone is closer than halation, but still not a true match.
- Halation is the biggest mismatch by far.
- Once effects are combined, the mismatch compounds and becomes much more obvious.

Updated conclusion:

- Keep FFmpeg as the export path.
- Do not replace FFmpeg with a full GPU export architecture right now.
- Treat the web preview look as the preferred aesthetic reference.
- Change FFmpeg export so it moves toward the preview look.

## What Works Well

### Bloom

`just_bloom_web.png` and `just_bloom.png` are fairly close.

Observations:

- Overall softness is in the same direction.
- The preview communicates the effect well enough for interactive editing.
- This is the strongest example of the current preview pipeline being "good enough" visually.

Why it works better:

- Bloom is structurally simple: blur the frame and screen blend it back.
- Even though the preview downsamples before blur, the result still lands in the same visual neighborhood.

### Split Tone

`split_tone_natural_web.png` vs `split_tone_natural.png` and `split_tone_comp_web.png` vs `split_tone_comp.png` are closer than halation.

Observations:

- The preview generally points in the right direction.
- Mode differences are visible.
- The export still has a slightly different balance and color response.

Why it works better:

- The preview reuses the same split tone math source for parameter generation.
- The effect is still not identical, but the high-level intent survives better than halation.

## What Does Not Work Well

### Halation

`halation_web.png` and `just_halation.png` do not match well.

Observations:

- The export is much stronger.
- The export has a much more pronounced pink/magenta cast.
- The glow spread and highlight behavior differ substantially.
- The preview understates what the final export will do.

This is the clearest preview/export parity problem in the app.

### Combined Effects

`mixture_1_web.png` vs `mixture_1.png` and `mixture_2_web.png` vs `mixsurte_2.png` diverge more than the isolated effect tests.

Observations:

- The exported result drifts warmer and more magenta.
- The web preview remains relatively restrained.
- The mismatch becomes more obvious when split tone, grain, bloom, and other passes stack together.

This strongly suggests the issue is not just one setting being wrong. It is cumulative drift from multiple non-identical implementations.

## Root Cause

The preview and export are built from different pipelines.

### Export path

Export is assembled in the FFmpeg filter graph:

- [pipeline.ts](/Users/robray/openhancer/src/pipeline.ts)
- [halation.ts](/Users/robray/openhancer/src/effects/halation.ts)
- [bloom.ts](/Users/robray/openhancer/src/effects/bloom.ts)
- [splitTone.ts](/Users/robray/openhancer/src/effects/splitTone.ts)

### Preview path

Preview is rendered by custom WebGPU shaders:

- [renderer.ts](/Users/robray/openhancer/src/ui/app/gpu/renderer.ts)
- [shaders.ts](/Users/robray/openhancer/src/ui/app/gpu/shaders.ts)

These are not equivalent implementations.

## Specific Mismatch Details

### 1. Halation algorithm mismatch

FFmpeg halation currently does this:

- split source
- isolate highlights using `curves`
- apply FFmpeg `hue`
- apply full-resolution `gblur`
- screen blend back

The WebGPU preview currently does this:

- threshold highlights with a custom shader
- downsample into half-resolution render targets
- blur in two shader passes
- apply hue/saturation through HSV conversion
- screen blend back

Why that matters:

- The highlight extraction is different.
- The blur footprint is different.
- The color shift logic is different.
- The blur happens at a different working resolution.

This is enough to produce the exact kind of mismatch seen in your examples.

### 2. Combined-effect compounding

Even where individual effects are "close enough", stacking them amplifies drift.

Likely contributors:

- Halation color drift feeds into later passes.
- Bloom is approximate rather than exact.
- Grain is implemented differently in preview vs FFmpeg.
- Split tone uses related math but not the exact same processing behavior.

### 3. Preview is designed as a fast renderer, not an exact renderer

This is an architectural issue, not just a bug.

The preview is optimized for:

- responsiveness
- browser rendering
- low-latency interaction

The export is optimized for:

- deterministic output
- codec/container support
- mature filter behavior

Those goals conflict unless both paths share one rendering implementation.

## Recommendation on GPU Export

Do not replace FFmpeg export with a full GPU export architecture right now.

Reason:

- Image export on GPU is straightforward enough.
- Video export on GPU is a much larger system:
  - decode frames
  - render every frame
  - encode video
  - preserve or mux audio
  - handle containers/codecs reliably
- FFmpeg already solves the hard export problems well.

Replacing FFmpeg would be a large rewrite with high risk and unclear product benefit relative to fixing preview parity.

Recommended stance:

- Keep FFmpeg for final export.
- Change FFmpeg effect behavior to align more closely with the preview look.
- If needed later, add GPU image export only.

## Source of Truth Decision

The preview look is preferred over the current export look.

That changes the direction of the fix.

Old framing:

- make the preview match FFmpeg

New framing:

- make FFmpeg match the preview

This is the right call if the preview is visually closer to the intended product.

Why this makes sense:

- The preview is the look the user actually wants.
- The current export, especially halation, is too aggressive and too magenta-heavy.
- Matching the preview is a better product decision than preserving export behavior the user does not like.

Important caveat:

- FFmpeg may not reproduce the preview mathematically exactly.
- The realistic goal is visual parity, not identical implementation.
- FFmpeg should remain the export backend, but its filters should be redesigned around the preview aesthetic.

## Suggested Fixes

### Priority 1: Rewrite FFmpeg halation to match the preview

This should be the first target.

Suggested actions:

- Redesign the FFmpeg halation pass to be much more restrained.
- Reduce the magenta/pink cast so it aligns with the preview.
- Reduce glow spread and intensity to align with the preview.
- Adjust highlight isolation so FFmpeg responds more like the preview.
- Validate every change against `halation_web.png` as the target look.

Expected outcome:

- Export halation becomes much closer to the desired preview look.
- Combined-effect exports also improve because halation is currently the largest source of downstream drift.

### Priority 2: Audit all FFmpeg effects against the preview effect-by-effect

Do side-by-side validation for:

- bloom
- split tone
- grain
- vignette
- aberration
- color settings

Use fixed reference images and compare:

- single-effect only
- two-effect combinations
- representative stacked presets

The key difference is that the preview should now be treated as the target, and FFmpeg should be tuned toward it.

### Priority 3: Tune stacked FFmpeg combinations against preview references

After single-effect tuning:

- test halation + bloom
- test halation + split tone
- test grain + split tone
- test representative full mixes

This matters because the current biggest mismatch appears when approximate differences stack.

### Priority 4: Add an "accurate preview" mode only if needed later

If the product goal is true WYSIWYG, the cleanest solution is:

- fast preview mode for editing
- accurate preview mode using FFmpeg or server-side rendered stills

This is still a valid future option, but it is lower priority if export is being tuned toward the preview rather than the reverse.

## Proposed Direction

Recommended implementation plan:

1. Keep FFmpeg as the export engine.
2. Scrap the idea of a full GPU video export architecture for now.
3. Treat the web preview as the aesthetic source of truth.
4. Rewrite FFmpeg halation first to match the preview more closely.
5. Tune the remaining FFmpeg effects against preview references.
6. Test stacked combinations after halation is fixed.
7. If exact parity is still required later, add an accurate FFmpeg preview mode rather than replacing export.

## Bottom Line

The core problem is that export and preview do not agree, and the current export look is not the preferred one.

Since the preview look is preferred, the practical fix is to move FFmpeg toward the preview rather than forcing the preview toward FFmpeg.

Best next move:

- keep FFmpeg export
- rewrite FFmpeg halation first
- then tune the rest of the FFmpeg pipeline toward preview parity
- then validate combined-effect parity
- avoid a full GPU export rewrite unless export ownership becomes a strategic requirement
