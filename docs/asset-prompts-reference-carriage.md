# Reference carriage sprite

- Destination: `public/assets/reference-carriage-v1.png`
- Generator: built-in `image_gen` tool, one generation, 2026-09-22.
- Input reference: `output/reference-review-2026-09-22/frame-08.jpg`, extracted from the user-provided video.
- Source generation: `/Users/sean/.codex/generated_images/01a0c854-75a1-75e2-bbdc-30015ec2e28f/exec-d935999a-bfbb-4ed5-b1e9-c9b6b5fbd1b2.png`
- PNG copied unchanged; no background removal or resampling was performed.
- Verified dimensions: 2172 × 724 px, RGBA, alpha extrema 0–255.
- Nonzero-alpha bounds: `(84, 134, 2093, 548)`; alpha ≥ 250 bounds: `(90, 294, 2087, 435)` (right/bottom exclusive).
- Visual inspection: isolated platen with both brass knobs, ruler and left return lever; no paper, body, bail, keys, text, UI or background rectangle. The generator retained more transparent padding and produced a thinner object than requested. Position from the visible alpha bounds when composing; do not stretch the full PNG to the hardware aspect ratio.

## Final prompt

Use case: background-extraction.
Asset type: a single independent transparent PNG sprite for a mechanical typewriter UI.
Input image 1 is the exact visual reference: copy only its upper horizontal carriage/platen assembly, preserving the reference's softly shaded stylized rendered aesthetic and exact simple geometry. This is not a redesign or a photorealistic different machine.

Subject: one long, straight, horizontal black-charcoal cylindrical platen roller; a circular warm brass knob at each end with the same radiating sunburst grooves as the reference; the thin straight brass ruler with small pale vertical tick marks that lies across the top/front of the black cylinder; the slender angled brass carriage-return lever extending from the left side. Both brass knobs should be the same diameter and face directly toward camera. Preserve the reference’s overall warm muted gold, black shading, soft highlights, round end profiles and front-facing camera. The ruler is an unbroken straight horizontal gold strip. No perspective rotation.

Remove absolutely everything else: no paper or paper fragments, no paper bail (the higher grey horizontal rod) and no bail rubber rollers, no upright center paper guide, no housing/body, no typebars, no ribbon or ribbon spools, no keys, no table, no wall, no UI, no logos, no text, no watermark. Tiny ruler tick marks only, no numbers or letters. Do not leave any dark background rectangle.

Output: genuine transparent alpha PNG. Wide, thin object whose complete content aspect ratio is approximately 8 to 10 wide by 1 high, including its lever; centered and entirely visible, with tight transparent margins. Prefer 1536 pixels wide. Transparent areas must be actual alpha, never a checkerboard painted into the image. Preserve all delicate sprite edges cleanly; no external drop-shadow on the transparent surroundings.
