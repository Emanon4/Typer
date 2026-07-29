# Typer Model 01 — prototype-locked rig

The visible machine is frozen to the Typer artwork already used by the product:

- `../../public/assets/typewriter-base.png`
- `../../public/assets/typewriter-with-paper.png`

Blender is used here as a mechanical rig and production-geometry tool. It is not allowed to redesign the machine. The low black-enamel shell, brass accents, compact keyboard, typebar-window scale, platen height, A4 sheet position, and frontal proportions in those two images are the exterior source of truth.

The first rig intentionally contains only one complete causal chain:

`Key_H` → `Key_Lever_H` → `Sublever_H` → `Typebar_H` → `Ribbon_Vibrator` → `Strike_Point` → `Escapement_Rack` → `Carriage_Root`

It also establishes the shared platen, paper bail, A4 sheet, line feed, and return hierarchy. Additional keys and finished shell surfaces are blocked until this chain aligns with the frozen prototype and passes validation.

`REFERENCE_ONLY` contains camera-calibrated image planes and alignment guides. It is excluded from GLB export. The production asset contains geometry and animation only.

Generate the rig with Blender 5.2 LTS:

```bash
blender --background --factory-startup --python blender/model-01/scripts/build_prototype_rig.py
```

Generated artifacts:

- `Typer_Model_01_Prototype_Rig.blend`
- `exports/typer-model-01-prototype-rig.glb`
- `exports/typer-model-01-prototype-rig.manifest.json`
- `exports/typer-model-01-prototype-rig.validation.json`
- `renders/01-prototype-alignment-idle.png`
- `renders/02-prototype-alignment-strike.png`

The older `../Typer_Model_01.blend` is an abandoned Underwood-shaped engineering experiment. It is retained only for traceability and is not a Typer product asset.
