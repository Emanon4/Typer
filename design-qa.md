# Design QA

## Comparison target

- Source visual truth: `reference/video-reference-typing.jpg`, `reference/video-reference-frame.jpg`, and `reference/feedback/paper-bail-reference.png`, all derived from user-supplied reference material.
- Browser-rendered implementation: `reference/qa/live-original-eight-lines-wide-text-v6.png`.
- Empty-sheet implementation: `reference/qa/live-original-final-blank-v6.png`.
- Paper-box implementation: `reference/qa/paper-box-desktop-final-v6.png`.
- Mobile implementation: `reference/qa/live-original-mobile-final-v6.png`.
- Desktop CSS viewport: 1280 × 800. Browser screenshot pixels: 1280 × 847. The visible app stage is 1200 × 800 CSS px at device scale 1.
- Mobile CSS viewport: 390 × 844. Browser screenshot pixels: 390 × 844 at device scale 1.
- Source pixels: 1280 × 1024 for the full machine capture and 930 × 170 for the focused paper-bail capture.
- State: source-video paper selected; blank insertion and eight-line return-feed states both checked.

## Combined comparison evidence

- Full view: `reference/qa/comparison-full-postfix-v6.png`. The source and implementation are in the same 1280 × 512 image. Each occupies a 640 × 512 panel; the 1280 × 847 implementation was proportionally reduced and vertically padded rather than distorted.
- Focused hardware view: `reference/qa/comparison-paper-bail-postfix-v6.png`. The source and implementation are stacked in the same 930 × 340 image, normalized to 930 × 170 per panel.
- Paper library: `reference/qa/paper-box-desktop-final-v6.png`. No source mock exists for this new interface, so it was checked against the user brief and the final raster assets rather than assigned false pixel-level fidelity.

## Findings

No actionable P0, P1, or P2 finding remains.

- Fonts and typography: Latin uses the self-hosted Special Elite face; Chinese uses a Song-style metal-type face. Both are stamped through the same canvas ink model with deterministic pressure, missing ink, ribbon-thread dropout, weak strikes, and occasional double impact. Live Chinese glyphs measure about 16 px high at the desktop viewport, matching the optical weight of the source rather than looking like clean DOM text. The live writing measure now begins about 11% inside the physical sheet, close to the source paper margin.
- Spacing and layout rhythm: the live paper width is 42% of the stage and the guide rod is 49%, matching the reference relationship between sheet, bail, and platen. At line zero only a shallow strip is visible. Each carriage return moves the whole sheet upward 23.99 px while the strike point and paper bail remain fixed. Eight lines reveal the page progressively without separating it from the platen.
- Colors and visual tokens: warm cream paper, restrained brass, black enamel, walnut, and the umber wall preserve the source's low-saturation warm-dark balance. Selected-paper borders and controls use the same aged-brass token family; no modern accent color leaks into the scene.
- Image quality and asset fidelity: the paper-bail rod and two rubber rollers are a real transparent raster extracted from the user's source screenshot, not CSS art. The machine remains a project-bound photoreal image. All five paper previews are real raster surfaces with correct crops and no placeholder geometry.
- Copy and content: the interface is standalone Chinese and contains no source branding or watermark. The five stocks are named and described by physical paper character rather than generic UI labels.
- States and interactions: paper selection applies immediately, persists after reload, and is shared by live writing, ejected review, and export. Enter, Chinese text input, ejection, empty export-disabled state, and selected-card state all worked through visible controls.
- Accessibility: the writer is a labelled textbox; controls and paper cards are semantic buttons; selected paper uses `aria-pressed`; modal states make the machine inert; focus indicators remain visible. The paper box exposes all five choices to the accessibility tree.
- Responsiveness: at 390 × 844 there is no document-level horizontal overflow. All four persistent controls remain visible. The paper rail scrolls internally from 328 px viewport width to 742 px content width, so later stocks remain reachable without pushing the page sideways.

The photoreal machine is intentionally more materially detailed than the reference's stylized 3D model. The mobile tap targets scale with the landscape-first stage and are smaller than a native mobile interface; the explicit mobile guidance recommends landscape or desktop. These are acceptable P3 differences for this experiential desktop instrument.

## Export verification

- Both live and ejected `导出 PNG` controls completed the real browser path through image loading, canvas rendering, `canvas.toBlob`, and download-anchor creation; the status changed to `高分辨率稿纸已导出` only after the blob resolved.
- `src/exportPaper.js` fixes the output at 2480 × 3508 pixels and draws the selected paper asset before stamping every glyph with the shared ink renderer.
- The in-app browser does not expose its sandboxed download destination to the filesystem, so this pass could not reopen the newly downloaded file from the host Downloads folder. This is a residual environment test gap, not a visible product failure.

## Primary interactions tested

- Selected all five stocks and verified their computed live-paper image URLs.
- Reloaded with `民国书简` selected and confirmed its card remained pressed and its paper stayed installed.
- Restored `原片米白` as the final default state.
- Typed Chinese, pressed Enter, and confirmed the page moved upward 23.99 px while the active line stayed at the platen.
- Repeated carriage return through line 8 and checked page bounds, bail bounds, glyph count, and absence of horizontal overflow.
- Ejected the sheet, inspected the full-page review, and triggered its scoped export control.
- Checked desktop and 390 × 844 mobile layouts, including the horizontally scrollable paper library.
- Browser console errors: none. Browser console warnings: none.

## Comparison history

- Earlier refinement removed clean DOM typography, synthetic sound, and approximate keyboard spacing by adding canvas ink, source-sampled mechanical audio, and individually measured raster key legends.
- The latest source comparison found a P2 paper-physics mismatch: the old sheet was narrow and fully visible at line zero, while only its ink layer moved after Return. The fix widened the physical sheet to the source-to-platen ratio, started it as a shallow visible strip, and moved the entire paper on a shared 24 px feed pitch. Post-fix evidence is `comparison-full-postfix-v6.png`.
- The latest feedback also identified the missing horizontal paper-bail line. The fix extracted the exact source rod and rubber rollers into `public/assets/paper-bail-reference.png`, aligned it to the platen, and coupled its horizontal motion to the carriage. Post-fix evidence is `comparison-paper-bail-postfix-v6.png`.
- The paper-library pass added five persistent selectable surfaces and verified the selected stock across live, review, and export states. Post-fix evidence is `paper-box-desktop-final-v6.png` and `live-letter-blank-v6.png`.

## Implementation checklist

- [x] Source paper width, insertion height, feed, and strike point visually normalized.
- [x] Exact paper-bail raster restored and coupled to the carriage.
- [x] Five period paper stocks installed with persistent selection.
- [x] Chinese Return behavior verified through eight lines.
- [x] Ejected review and both export controls exercised.
- [x] Desktop and mobile states checked without document overflow.
- [x] Browser console checked with no errors or warnings.
- [x] Production build and Sites worker tests passed.

final result: passed
