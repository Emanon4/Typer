# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product Direction

- The formal product and repository name is `Typer`. Keep that name consistent in product copy, filenames, package metadata, local project naming, and remote repository naming. The product slogan is exactly `让你情不自禁地开始写作！`.
- This prototype is an experiential writing instrument, not a generic editor or landing page.
- Deeply simulate a real mechanical typewriter: fixed strike point, moving carriage, key depression, typebar strike, carriage return, paper advance, mechanical audio, and paper ejection.
- Chinese input is mandatory. Use the operating system IME and commit selected Chinese graphemes to paper without breaking composition events.
- Preserve typewriter constraints. Backspace moves the carriage but does not erase ink already printed on the sheet.
- Keep the visual direction original while matching the supplied video's warm, dark, tactile composition. Do not reproduce the video's brand or watermark.
- Use a photorealistic paper scan with visible fiber and small manufacturing variation for both the live sheet and exported output.
- Keep paper feed and printed-line movement on one shared coordinate system so carriage return never separates the sheet from the platen.
- Align every raster key legend to the measured center of its photographed keycap; do not approximate rows with a uniform gap.
- Finished drafts must export as a high-resolution PNG that preserves the same paper and ink rendering seen on screen.
- Keep the original video's paper bail rod and rubber rollers as a visible foreground hardware layer aligned to the moving carriage.
- The paper box must preserve both the source-video paper and the high-fiber paper, add period-appropriate letter, grid, and ruled stock, persist selection, and use the selected stock in live writing, review, and export.
- The source-video stock is the default. At line zero only the same shallow paper strip seen in the source may sit above the platen; carriage return must physically lift the entire sheet while the strike point and paper bail stay fixed.
- Keep two deliberately separate experiences: the existing 3:2 mechanical close-up and a full-viewport photorealistic writer's-desk mode. The desk mode must feel like a real machine sitting in front of the writer, with physically plausible lighting, paper fall, worn materials, books, loose pages, ink, and an ashtray; controls should visually recede while writing.
- Live stock is an A4 sheet at the physical 210:297 ratio. Chinese copy should use ordinary tight text spacing, a slightly tighter line pitch, and enough vertical capacity for a full page instead of stopping after a short sample.
- The paper bail must remain visible without crossing the active printed line. Paper and machine occlusion must use one clean physical boundary; never duplicate a clipped machine raster in a way that creates seams or torn geometry.
- One physical typebar rises for each printed glyph. Different glyphs should visibly originate from different positions in the fan while converging on the same fixed strike point, as a real basket mechanism does.
- Ejected sheets can be deliberately stored in a persistent manuscript box and reopened later with their paper stock and ink rendering intact.
- The full-screen writer's desk includes all three approved environments: Night Lamp, Morning Study, and Rainy Midnight. Users can independently choose black-and-brass, ivory-and-nickel, or forest-green-and-brass typewriters in every desk environment.
- Mechanical motion must be physically faithful. Chinese is produced by a hidden digital type-slug adapter at the real strike instant; the adapter changes only the printed glyph and never fakes or bypasses the visible linkage.
- Preserve the current photographed Typer exterior as the production visual baseline. Do not replace it with a newly invented 3D exterior unless a later, separately approved modeling project starts from multi-view design drawings and dimensions.
- Browser mechanics must use clean independently rendered parts and one shared state model. Never animate a clipped duplicate of the full machine photograph; if a part cannot move without exposing a raster seam, keep the photographic part fixed and express the motion with a seam-free DOM/CSS part.
- Build and validate one complete typewriter before adding more styles. The first gate is one key-to-typebar-to-paper-to-escapement causal chain with a shared paper-feed and strike coordinate system, with zero overlap between the active line and the paper bail.
- Match the reference video's carriage logic: paper and bail move horizontally as one carriage assembly; carriage return restores that assembly while advancing the A4 sheet by exactly one derived line pitch. The bail sits between the previous printed row and the active strike row at every line index.
- Freeze the visible design of the first machine to `public/assets/typewriter-base.png` and `public/assets/typewriter-with-paper.png`. Their low black-enamel body, brass trim, compact key field, front silhouette, platen height, paper position, and overall proportions are the exterior source of truth for all implementation.
