# Apex Engine v0.2 Sprint — Unity Port Ledger

This document records the first large production-architecture sprint after the Apex Renegade Three.js/WebGPU prototype was frozen as an executable design reference.

## Production rule

**Port validated behavior, not browser implementation.** Unity owns rendering, physics, terrain, build targets and authoring. Apex Engine owns reusable gameplay architecture, game feel contracts, diagnostics and game-specific integration points.

## Apex Engine modules

- `Apex.Core` — service lifecycle, runtime reset, common math
- `Apex.Settings` — persisted input / comfort / audio / graphics / accessibility preferences
- `Apex.Input` — Input System actions, radial deadzones, response curves, binding overrides, rebinds, haptics
- `Apex.Combat` — health/shield/damage, deterministic weapon state, weapon definitions/runtime/loadouts, aim assist
- `Apex.AI` — reusable combat-agent movement/state/stagger/attack requests
- `Apex.Traversal` — accelerated FPS movement, crouch/slide/dash/jump/landing events, bike contract, six-direction flight
- `Apex.World` — region tracking, stream cells, distance/performance-aware runtime streaming
- `Apex.Save` — checkpoints plus generic typed game payload persistence
- `Apex.Encounter` — waves, spawn adapters, escalation meters and three-tier population budgets
- `Apex.Interaction` — scanner, prompts and interactable contract
- `Apex.UI` — pause-state service
- `Apex.Audio` — settings-aware procedural cue service / buses
- `Apex.Camera` — reusable camera impulse/recoil/shake state
- `Apex.Graphics` — persisted quality settings + adaptive runtime quality response
- `Apex.Debug` — frame telemetry, adaptive performance state, reusable scenario-command harness
- `Apex.Abilities` — charge meter and reusable timed/cooldown ability runtime

## Apex Renegade integration

### Player / feel

- accelerated ground movement instead of input=velocity
- sprint, crouch, jump, dash and sprint-to-slide
- ground/air acceleration split
- landing-weight events
- footsteps by distance/speed
- head bob is a separate comfort-scaled camera channel
- recoil/damage/boost/landing use shared camera impulse state
- procedural audio + haptic bridges subscribe to gameplay truth rather than polling presentation state

### Weapons

**Corona Blaster**
- 18-round magazine
- 126 starting reserve
- automatic ~8.5 rps
- 1.12s reload
- 24 damage
- energy damage
- ~220m range
- controller ADS aim assist

**Maw**
- 6-round magazine
- 36 starting reserve
- ~1.15 shots/sec
- 1.58s reload
- 9 pellets
- 15 damage / pellet
- 4.7° base spread
- ~46m range
- ballistic damage
- stronger recoil / camera impulse / haptics

Shared systems:
- deterministic weapon state
- dry-fire events
- reload events
- weapon swapping
- routed ammo pickups
- save-restorable magazine/reserve state
- hitmarker / kill confirmation
- procedural viewmodels + movement bob
- bike temporarily equips Corona without losing the on-foot loadout selection

### Bike

- Rigidbody prototype with continuous collision
- throttle / braking / speed cap
- boost energy
- drift grip and visual lean
- wheelie state / visual pitch
- mounted Corona on RB
- recall
- launch-safe under-world recovery
- actual player transform follows bike while mounted
- speed/drift/boost-derived impact damage
- terrain-aware front/rear chassis probes for visible slope pitch + suspension travel
- cinematic right-stick/mouse orbit camera
- delayed camera recenter
- speed/wheelie/drift-aware framing
- camera collision resolver
- mount latency + recall travel telemetry in development logs

### Flight

- reusable `ApexFlightController`
- `G / D-pad Up` toggle
- six-direction CharacterController flight
- jump / crouch = ascend / descend
- sprint = flight boost
- independent pitch/yaw/bank presentation
- speed-based flight lens expansion
- flight audio / haptic / camera feedback
- automatically yields ownership when the bike mounts the player

### Apex Surge

- reusable charge meter + ability runtime underneath
- hits / kills / high-pressure damage build Apex Charge
- on-foot RB when full activates Apex Surge
- activation radial burst
- short active spectral aura window
- aura pulses damage/stagger nearby threats
- partial shield restoration
- Pressure / Refusal interaction
- dedicated HUD charge meter
- standalone ability smoke certification

## Enemy / encounter architecture

### Full AI tier

`RenegadeEnemyAgent` composes `ApexAgentMotor` + `HealthComponent`.

**Hollow**
- ~82 HP
- faster pursuit
- energy attack
- more staggerable

**Enforcer**
- ~190 HP + shield
- slower / heavier
- larger preferred range
- stronger attack
- reduced stagger
- higher aim-assist priority

The first authored encounter uses the reusable encounter controller and spawn adapter instead of hard-coded initial enemies.

### Pressure / Refusal

Pressure stages:
1. UNNOTICED
2. RESPONSE
3. MOBILIZATION
4. REGIONAL SIEGE
5. TOTAL CONTAINMENT

Refusal tiers:
1. T0 BASELINE
2. T1 AWAKENED
3. T2 OVERDRIVE
4. T3 APEX

Pressure responds to shots, hits, kills and damage; Refusal responds more strongly to sustained/close-call pressure. World atmosphere and reinforcement logic subscribe to these systems.

### Three-tier War Field

The game does **not** attempt hundreds of full GameObjects/AI agents.

Pressure selects a population budget:
- nearby full AI
- lightweight instanced visible contacts
- distant instanced formations

Upper pressure budgets reach hundreds of visible contacts while full AI remains constrained. `ApexPerformanceBudget` can reduce the lightweight/distant tiers before sacrificing core combat.

## World production

World spine remains:

**The Scar → The Expanse → Vertical Megacity**

The sprint introduces the first Unity-native physical geography:
- serialized `TerrainData`
- 257² heightmap
- ~1.8km x 2.2km Expanse terrain
- mathematically flat central highway corridor
- rising off-road ridges / basins / macro relief
- generated TerrainLayer/texture
- real `TerrainCollider`
- old flat Expanse slab moved below terrain as safety catch rather than co-planar drive surface

Runtime detail is grouped into Scar / Expanse / Vertical stream cells with hysteresis. Performance state can contract cell ranges under sustained load.

## Graphics / performance

Persisted settings:
- quality budget: Low / Medium / High / Ultra
- frame target: 30 / 60 / 90 / 120 / 144
- VSync
- fullscreen
- shadow distance
- LOD bias
- MSAA off / 2x / 4x / 8x

`ApexPerformanceBudget` evaluates sustained frame time relative to the *selected* target frame rate and enters:
- Nominal
- Constrained
- Critical

Consumers can respond by reducing:
- shadow range
- LOD bias
- AA
- reflection probes
- world stream distance
- lightweight/distant army population

F8 diagnostics expose frame time, FPS, budget state, stream cells, bike speed, region, Unity version, build version, commit and CI run provenance.

## Save / checkpoint

`Apex.Save` remains game-agnostic.

Apex Renegade persists a typed payload containing:
- selected weapon
- magazine / reserve state per weapon
- Pressure
- Refusal

The game-specific bridge also installs the generic first-person checkpoint marker; this corrected an early port bug where trigger checkpoints could silently ignore the Renegade.

## Developer QA / autonomous workflow

### Scenario service

F9 in Development builds opens the Apex scenario console.

Commands include:
- `goto scar`
- `goto expanse`
- `goto vertical`
- `spawn hollow 10`
- `spawn enforcer 4`
- `stress 60`
- `clear`
- `pressure 0.9`
- `refusal 0.8`
- `refill`
- `bike recall`
- `bike summon`
- `checkpoint`
- `scarwar`
- `expanse_ride`

This exists so game-feel, combat and performance testing can begin from repeatable states instead of manual setup.

### Automated gates

EditMode protects:
- settings sanitation
- deadzone/response shaping
- deterministic weapon state
- runtime fire/reload/dry-fire events
- loadout switching / ammo routing
- escalation stage transitions
- AI tuning sanitation
- camera impulse recovery
- aim-assist selection
- charge-meter behavior
- ability activation/cooldown

PlayMode protects:
- complete bootstrap
- player/vitals/checkpoint marker
- Corona + Maw
- bike
- interaction/pickups
- Pressure/Refusal
- encounter spawning
- AI agents
- War Field
- streaming/performance/haptics
- audio cues
- runtime material
- Terrain / TerrainCollider
- scenario command execution
- bike recall movement
- vitality restore
- Flight / Apex Surge auto-install

### Standalone-player gate

Editor/PlayMode success alone is **not sufficient** after the first Windows build exposed shader stripping.

Every certified playable must now launch the actual `ApexRenegade.exe` and produce both:
- `[Apex Player Smoke] PASS`
- `[Apex Ability Smoke] PASS`

The base player smoke verifies shader/material retention, build provenance, player, checkpoint marker, bike impact integration, weapons, camera, HUD, interaction, enemies, War Field, save bridge, TerrainCollider, streaming, adaptive performance, graphics, haptics, scenario service, audio and save health.

## Build provenance

Each CI build writes `Resources/Apex/BuildInfo.txt` with:
- exact Apex commit SHA
- workflow run id
- run number
- UTC build time

The same data is shown by F8 diagnostics. This prevents confusion between stale and current Windows builds during rapid autonomous iteration.

## Explicitly still production TODO

- authored hero assets / Scenario art pass
- production rendering-pipeline decision and material library
- authored world props / roads / architecture kit
- true wheel/suspension bike physics beyond current stable Rigidbody + visual surface pose
- deeper flight power/progression rules
- Coil melee implementation
- Voss boss production behavior
- richer Hollow/Enforcer attacks and telegraphs
- large-world additive scene / Addressables streaming
- higher-fidelity animation rigs
- final music/voice/audio assets and mixer setup
- full accessibility matrix beyond current comfort/input/presentation controls
- shipping UI framework replacing prototype IMGUI surfaces
- Steam/platform services
- console certification/platform integration

## RC rule

Do not merge PR #10 simply because CI is green. The current RC must also pass a human feel gate for:
- mount latency
- Corona / Maw feel
- aim/controller response
- sprint / slide / dash
- bike recall / boost / drift / wheelie
- bike camera
- physical Expanse terrain
- Flight
- Pressure/Refusal readability
- enemy pressure
- frame pacing / adaptive budget behavior
