# Typer Blender source

> Historical notes from July 2026. This directory archives a retired experiment, not the current application implementation. Only unique source files and references are included; generated exports, renders, and the separate prototype rig are omitted.

The product track at that time was [`model-01/` in Git history](https://github.com/Emanon4/Typer/tree/60049b925301127ffc8def43d58f004fc5dbf667/blender/model-01).

Its exterior is locked to the black-and-brass Typer artwork in `public/assets/typewriter-base.png` and `public/assets/typewriter-with-paper.png`. Blender supplies articulated geometry and one physically causal mechanical state; it does not select a new historical typewriter design.

The files at this folder's root—`Typer_Model_01.blend`, `scripts/build_typer_model_01.py`, `exports/typer-model-01.glb`, `renders/`, and `reference/underwood-no-5/`—belong to an abandoned Underwood-shaped experiment. They are retained temporarily for traceability only and must not be used by the website or copied into the Typer repository as production assets.

Current editable source:

- `model-01/Typer_Model_01_Prototype_Rig.blend`

Current browser export:

- `model-01/exports/typer-model-01-prototype-rig.glb`

The historical prototype builder is available at the linked commit. To regenerate it, first restore that historical tree; the command below refers to its original layout:

```bash
blender --background --factory-startup --python blender/model-01/scripts/build_prototype_rig.py
```
