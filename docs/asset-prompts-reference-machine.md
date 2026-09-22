# Reference machine body

- Output: `public/assets/reference-machine-body-v1.png`
- Tool: built-in `image_gen` edit, one call.
- Source: `output/reference-review-2026-09-22/frame-08.jpg`, inspected locally before generation.
- Saved result: 1536 × 1024 RGBA PNG with a real alpha channel.
- Nontransparent alpha bounds: `(0, 32)–(1532, 1024)` including faint edge pixels; alpha ≥ 32 body bounds: `(20, 83)–(1516, 938)`.
- Alpha extrema: 0–254. Corners and sampled outside-body pixels are fully transparent. RGB color underneath zero alpha is present in the generator output and must not be flattened.
- Visual check: correct wide low body, two ribbon spools, symmetrical silver fan, four keyboard rows, two SHIFT keys, long spacebar; no paper, platen, side knobs, bail or app controls. Only TYPER branding remains.
- Integration landmarks in native 1536 × 1024 pixels: small central gold ribbon guide at approximately `(768, 115)`; fan pivot at `(768, 395)`; upper housing corners near `(58, 214)` and `(1478, 214)`; row centers around `y=499, 601, 703, 804`; spacebar center at `(768, 898)`.

## Prompt

```text
Use case: background-extraction with precise-object-edit.
Asset type: transparent PNG static typewriter-body sprite for an interactive web typewriter, at about 1536 x 1024 pixels, a wide landscape canvas with only a small transparent margin.
Edit target: the provided reference screenshot. Faithfully extract and reproduce the TYPEWRITER BODY ONLY in exactly the reference's visual style, proportions, angle, silhouette, light, and materials. This is a clean, softly shaded, almost front-on slightly top-down skeuomorphic UI typewriter, with an unusually broad low black rectangular body, NOT a bulky photographic antique and NOT a redesign.
Keep: the wide low charcoal-black upper housing; symmetrical exposed fan of about 12 slender silver typebars on each side converging at a small central bottom black cover; two dark burgundy-black round ribbon spools with brass central pins, black and dark red ribbons stretching to a small central gold ribbon guide; compact four keyboard rows of large round black keycaps with fine brass circular outlines; two pill-shaped SHIFT keys and long slender centered spacebar; the black base and narrow front edge. Preserve the original camera perspective and actual body proportions. Match the source's detailed soft gradients, fine brass highlights, restrained dark surfaces, sharp mechanical edges, and clean rendered style.
Remove entirely: ALL wall and desk/background pixels, paper sheet, all typed manuscript text, ALL horizontal paper bail rods/rubber paper rollers, the entire top horizontal cylindrical platen/roller, both gold round platen side knobs, all carriage ruler markings/rail, return lever, all top app controls, source branding, screen titles, bottom hints and watermark. The removed parts will be real separate animated components in the app.
The top of the isolated body should end around the upper housing, ribbon spools and fan. Preserve the central raised small gold ribbon guide as part of the fan assembly.
Keyboard labels in correct order, crisp and legible: row 1 '1 2 3 4 5 6 7 8 9 0 -'; row 2 'Q W E R T Y U I O P'; row 3 'A S D F G H J K L ; \''; row 4 'SHIFT Z X C V B N M , . / SHIFT'. No duplicate or invented letters. Add only an extremely small subtle gold 'TYPER' label at the top center of the black housing; no other brand text.
Output requirements: actual transparent alpha background, no checkerboard baked in, no colored background, no table or ground plane, no cast shadow outside the object. Entire body fully visible, not cropped. Fill the canvas width with the body leaving a modest 30 px transparent margin. Preserve the original reference body silhouette and design rather than making up a new typewriter.
```
