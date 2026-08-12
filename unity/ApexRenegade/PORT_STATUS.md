# Apex Renegade Unity Port — Migration Ledger

## Gate

**Do not merge this port into `main` until the self-hosted Unity editor compiles the project and EditMode tests pass.**

Current external blocker: the Windows headless runner's Unity `6000.4.11f1` reports no valid Editor license and exits with code 198 before package import or C# compilation.

## Apex Engine v0.1

| System | State | Notes |
|---|---|---|
| Core/service lifecycle | Foundation | `Apex.Core` registry/runtime lifecycle |
| Settings | Foundation | persistent JSON; aim, accessibility, audio, FOV, camera comfort |
| Input | Foundation | Input System actions, deadzones, curves, mouse/controller look, binding override persistence, interactive rebind API |
| Combat | Foundation | health + shield, damage payloads, weapon state machine |
| Aim assist | Architecture | target contract + deterministic resolver/scoring; game-specific target acquisition still pending |
| Traversal | Foundation | FPS motor + Rigidbody bike contract, boost, drift grip, mount/dismount, recall |
| Interaction | Foundation | scanner + generic prompt/interactable contract |
| Save/checkpoint | Foundation | JSON slot, checkpoint data, respawn transform contract |
| World | Foundation | reusable region volumes/tracker; real streaming implementation pending |
| Encounter | Foundation | data-driven waves + spawn-adapter contract |
| Debug/testing | Foundation | frame telemetry, batch validation entrypoints, EditMode regression tests |

## First playable Apex-specific bootstrap

Implemented programmatically under `Assets/ApexPort` so the port can be generated/tested headlessly:

- The Scar → The Expanse → Vertical Megacity world-spine massing
- physical ground/road/urban primitive colliders
- Renegade CharacterController baseline movement
- nearby Renegade Bike
- mount / dismount / remote recall
- Rigidbody boost + drift-grip prototype
- independent right-stick/mouse motorcycle orbit camera with delayed recenter
- speed-sensitive chase distance and FOV
- three named region volumes

This is **not** intended as final art or final vehicle physics. It is the Unity behavior parity scaffold.

## Validated in the web prototype, still to port

- Corona/Maw weapon implementations and viewmodel animation
- ADS presentation, recoil/reticle response, hitmarkers, directional damage UI
- bike-mounted Corona fire, drift damage, wheelies, launch dismount, spectral VFX/audio
- Refusal progression and Pressure/army escalation
- Hollow / Enforcer / Voss combat behavior
- pause/settings UI and full accessibility presentation
- checkpoint/death UI flow
- authored terrain/streaming/LOD production pipeline
- Scar/Expanse/Vertical production visuals
- large-scale encounter simulation tiers

## Next autonomous passes

1. **Compile gate:** restore runner license; compile/import; fix C#/package issues; run EditMode tests.
2. **AAA Baseline:** finish Input/Settings/Combat/UI/Save/Interaction/Encounter frameworks and wire them into the playable bootstrap.
3. **Behavior parity:** Corona + enemies + Pressure/Refusal + full bike combat/traversal.
4. **Game Feel:** recoil, camera, aim assist, impacts, animation timing, audio, movement/bike curves.
5. **World production:** Unity-native terrain, scene/Addressables streaming, LOD/GPU-driven rendering, authored environments.
