# Apex Renegade Unity Port — Migration Ledger

## Gate

**First Unity playable gate: GREEN. PR #10 remains draft until human feel/playtest approval.**

Verified on the self-hosted Windows runner with Unity `6000.4.11f1` under the interactive `Richard` user so the Unity Personal entitlement is visible.

Green pipeline run: `unity-headless-lab` Actions run `31624170847`.

Passed in sequence:

1. headless project import + `Apex.Editor.ApexBatch.CreateAndValidate`
2. EditMode regression suite
3. PlayMode runtime smoke suite
4. Windows x64 development player build
5. playable artifact upload

The earlier code-198 licensing blocker is resolved for the interactive runner path. Keep `E:\actions-runner\run.cmd` open while using this setup; the Windows service is currently stopped because it runs as `NETWORK SERVICE` and cannot see the Personal entitlement.

## Apex Engine v0.1

| System | State | Notes |
|---|---|---|
| Core/service lifecycle | Working foundation | `Apex.Core` registry/runtime lifecycle + subsystem static reset |
| Settings | Working foundation | persistent JSON; aim, accessibility, audio, FOV, camera comfort; runtime pause/settings surface |
| Input | Working foundation | Input System actions, radial deadzones, response curve, acceleration, mouse/controller look, binding override persistence, interactive rebind API, separate vehicle-fire actions |
| Combat | Working foundation | health + shield, damage payloads, deterministic weapon state machine, reusable `WeaponDefinition` / `ApexWeaponRuntime` |
| Aim assist | First integration | deterministic resolver/scoring; first Hollow targets registered; assist applied to controller ADS only |
| Traversal | First integration | FPS motor + Rigidbody bike, boost, drift grip, mount/dismount, remote recall, cinematic right-stick/mouse bike camera |
| Interaction | Foundation | scanner + generic prompt/interactable contract; pickup/content integrations pending |
| Save/checkpoint | First integration | JSON slot, valid-checkpoint tracking, Scar/Expanse/Vertical checkpoints, death/respawn transform flow |
| World | Foundation | reusable region volumes/tracker; production terrain/streaming/LOD still pending |
| Encounter | Foundation | data-driven wave + spawn-adapter contract; first bootstrap Hollow group is still directly authored in port code |
| UI | First integration | real pause state, cursor state, settings panel, HUD, ammo/vitals/region/bike status, hit/kill markers, damage/respawn feedback |
| Debug/testing | Working foundation | telemetry, batch validation, EditMode regressions, PlayMode runtime smoke harness, automated Windows build |

## First playable Apex-specific bootstrap

Implemented programmatically under `Assets/ApexPort` so the port can be generated, tested, and built headlessly:

- The Scar → The Expanse → Vertical Megacity world-spine massing
- physical ground/road/urban primitive colliders
- Renegade CharacterController baseline movement
- 100 HP + 55 shield first-pass vitals
- Corona Blaster on reusable weapon framework
- 18-round magazine / reserve ammo / cadence / reload state
- ADS presentation + ADS FOV
- procedural first-person Corona viewmodel + recoil response
- reticle, ammo, vitals, reload state, hitmarker, kill confirm
- directional damage feedback + death/checkpoint/respawn loop
- six first-pass Hollow targets with pursuit, attack, hit flash, stagger, death feedback
- controller-only aim-assist target resolver
- nearby Renegade Bike
- mount / dismount / remote recall
- Rigidbody boost + drift-grip prototype
- bike-mounted Corona on RB while RT remains throttle
- independent right-stick/mouse motorcycle orbit camera with delayed recenter
- speed-sensitive chase distance and FOV
- three named region volumes and physical checkpoints
- real pause state + first settings screen

This is **not** final art, AI, gun feel, world production, or vehicle physics. It is the first compiled behavior-parity/AAA-foundation playable.

## Automated smoke coverage

EditMode currently protects:

- settings sanitization
- anti-stick-drift shaping / response direction
- deterministic weapon fire + reload state
- weapon runtime shot/reload/dry-fire events
- aim-assist centered-target preference

PlayMode currently protects:

- runtime bootstrap creates Renegade, vitals, Corona, bike, region tracker, Hollow encounter and initial checkpoint
- Renegade Bike recall measurably closes distance to the player

## Still to port / productionize

- Maw + general weapon loadout/swap framework integration
- ammo pickups and generic interaction-prompt presentation
- controller-remapping UI (underlying rebind/persistence API already exists)
- proper audio service/mix buses and shooter/bike/world audio
- stronger recoil/camera shake/animation and screen-space game-feel FX
- full accessibility presentation and controller-native menu navigation
- bike wheelies, launch dismount, drift damage and stronger suspension/ground model
- Refusal progression and Pressure/army escalation
- Encounter Framework integration for Hollow / Enforcer / Voss and large-scale simulation tiers
- world streaming, Unity Terrain, authored collision/LOD/GPU-driven production pipeline
- Scar/Expanse/Vertical production visuals
- performance budgets/profiler markers beyond first telemetry

## Next autonomous passes

1. **Human feel gate:** play the first Unity Windows build and record movement, Corona, Hollow, death, recall, boost/drift, camera, mount latency and general frame feel.
2. **AAA Baseline completion:** audio, interaction/pickups, weapon swapping/Maw, remap UI, controller-native settings, encounter wiring, richer profiling.
3. **Game Feel:** recoil, camera, aim assist, impacts, animation timing, movement curves, bike suspension/drift/wheelie/recall presentation, audio/VFX.
4. **Behavior parity + escalation:** Pressure/Refusal, Hollow/Enforcer/Voss, army-scale response, bike combat expansion.
5. **World production:** Unity-native terrain, region streaming/Addressables, LOD/GPU-driven rendering, authored Scar/Expanse/Vertical environments.
