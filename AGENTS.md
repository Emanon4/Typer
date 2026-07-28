# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product Direction

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
