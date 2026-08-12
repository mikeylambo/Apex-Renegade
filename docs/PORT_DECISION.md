# Apex Renegade — Engine Port Decision Checkpoint

This document records the evidence threshold for moving the production game away from the current Three.js/WebGPU runtime.

Do not port because another engine has more features. Port when Apex's required features are repeatedly consuming more engineering time than game/content work after the current runtime has received a fair optimization pass.

## Must-measure before deciding

- first bike mount latency after the full world is compiled
- sustained frame time on foot and on bike through Scar, Expanse, and Vertical Megacity
- render vs simulation/update frame cost
- draw calls / triangles / post-processing mode
- world collision reliability at high speed
- time required to author one new polished district/biome

## Port pressure indicators

- world streaming/LOD/culling infrastructure dominates feature development
- high-speed traversal remains hitchy after material/pipeline prewarm and region budgets
- reliable terrain/collision authoring requires bespoke tools for every biome
- adding a polished district requires substantially more engineering than art/design work
- target console work becomes near-term rather than eventual

## Stay indicators

- 60 fps target can be held with representative combat and traversal
- world authoring can be data-driven and procedural without frequent one-off fixes
- bike/flight traversal remain stable through streamed regions
- authored assets can be inserted without rewriting rendering/world systems

The current Visual Ceiling experiment is explicitly intended to collect this evidence.