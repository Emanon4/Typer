# Typer Model 01 mechanical research notes

This document records mechanical research only. The visible product exterior is not based on an Underwood machine. It is frozen to `public/assets/typewriter-base.png` and `public/assets/typewriter-with-paper.png`; the active rig and acceptance contract live in `model-01/`.

## Physical reference

The hidden mechanism may use the front-strike basket principles documented in early typewriter patents. Typebars pivot in a segment and converge on one printing point. Near the end of travel, the active typebar engages a universal bar, which releases the escapement and advances the spring-driven carriage by one pitch. These references define causal motion, not Typer's visible silhouette or detailing.

Primary references:

- Underwood typebar segment and common printing point: https://patents.google.com/patent/US843997A/en
- Key lever, sublever, typebar, platen, universal bar, and escapement chain: https://patents.google.com/patent/US1384122A/en
- Carriage rack and escapement wheel relationship: https://patents.google.com/patent/US1347197A/en
- Paper bail and front platen feed: https://patents.google.com/patent/US2555645A

## Coordinate system

- X: carriage travel, positive to the operator's right.
- Y: machine depth, positive away from the operator.
- Z: height.
- Units: metres.
- `Strike_Point` is the single source of truth for typebar convergence and ink placement.
- `Carriage_Root` owns the platen, paper, bail, rollers, knobs, and return lever.
- `Paper_Feed_Root` owns only the deformable A4 sheet and its UV space.

## Runtime contract

1. A physical keyboard event lowers the selected key and rotates its key lever.
2. The sublever rotates the selected typebar around its stored pivot.
3. The ribbon vibrator rises before the type slug reaches `Strike_Point`.
4. Ink is committed only when the type slug crosses the strike threshold.
5. The universal bar releases one escapement step after the impression.
6. `Carriage_Root` advances by the configured pitch.
7. Return resets the carriage while the platen and `Paper_Feed_Root` advance by one line.
8. The hidden CJK adapter changes only the glyph mask written to the paper texture. It does not alter the visible linkage or timing.

## Prototype acceptance

- No object intersections in idle, strike, rebound, or return frames.
- The active type slug reaches `Strike_Point` without changing the bar's length.
- Paper, ink, platen, bail, and rollers share the same carriage transform.
- The GLB contains named parts, animation tracks, material assignments, and custom mechanism metadata.
- Browser viewport changes affect the camera only; they never recalibrate part positions.
