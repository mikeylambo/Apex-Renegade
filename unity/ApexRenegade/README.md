# Apex Renegade — Unity Production Port

This Unity project is the production port of the browser prototype. The web runtime remains in the repository as an executable design reference.

## Editor target

- Headless lab editor: Unity `6000.4.11f1`
- Input System 1.17
- Cinemachine 3.1
- We can reassess an LTS production pin later; the first port milestone deliberately targets the editor already installed on the verified Windows headless runner.

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

Verified runner executable:

`E:\6000.4.11f1\Editor\Unity.exe`

Typical validation:

```powershell
& $env:UNITY_EXE -batchmode -nographics -quit `
  -projectPath <repo>\unity\ApexRenegade `
  -accept-apiupdate `
  -executeMethod Apex.Editor.ApexBatch.CreateAndValidate `
  -logFile Logs\apex-compile.log

& $env:UNITY_EXE -batchmode -nographics -quit `
  -projectPath <repo>\unity\ApexRenegade `
  -runTests -testPlatform EditMode `
  -testResults TestResults\editmode.xml `
  -logFile Logs\apex-tests.log
```

`ApexBatch.CreatePortScene` creates/recreates the first generated port scene and installs it into EditorBuildSettings.

## Port rule

Do not translate Three.js implementation details one-for-one. Port **validated behaviors** and use Unity-native systems where they are superior. The browser build is the feel/spec reference, not the engine architecture reference.
