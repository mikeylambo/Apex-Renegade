# Apex Renegade — Unity Production Port

This Unity project is the production port of the browser prototype. The web runtime remains in the repository as an executable design reference.

## Editor target

- Unity 6.3 LTS
- Project currently pins `6000.3.12f1`; opening in a newer 6.3 LTS patch is expected to upgrade ProjectVersion metadata.
- Input System 1.17
- Cinemachine 3.1

## Architecture: Apex Engine v0.1

`Assets/ApexEngine` contains reusable gameplay modules rather than Apex-Renegade-specific content:

- `Core` — service registry and lifecycle contracts
- `Settings` — persistent accessibility/input/gameplay preferences
- `Input` — Input System action map, deadzones, look curves, rebinding persistence
- `Combat` — damage/health and weapon-state foundation
- `Traversal` — first-person motor + reusable vehicle contracts
- `World` — region metadata and world bootstrap contracts
- `Debug` — runtime telemetry hooks

`Assets/ApexPort` is the game-specific layer. It is allowed to know about the Renegade, Refusal, the bike, The Scar, The Expanse, and Vertical Megacity. Apex Engine is not.

## Headless entrypoints

Once a Unity executable is available in the environment:

```bash
Unity -batchmode -nographics -quit -projectPath unity/ApexRenegade \
  -executeMethod Apex.Editor.ApexBatch.ValidateProject \
  -logFile -

Unity -batchmode -nographics -quit -projectPath unity/ApexRenegade \
  -runTests -testPlatform EditMode \
  -testResults unity/ApexRenegade/TestResults/editmode.xml \
  -logFile -
```

`ApexBatch.CreatePortScene` creates/recreates the first generated port scene and installs it into EditorBuildSettings.

## Port rule

Do not translate Three.js implementation details one-for-one. Port **validated behaviors** and use Unity-native systems where they are superior. The browser build is the feel/spec reference, not the engine architecture reference.
