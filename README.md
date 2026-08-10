# Apex Renegade

A fast, spectral open-world character-action FPS built with Three.js, WebGPU/TSL, Vite, and Rapier.

Current baseline: **WORLD SPINE v0.1 — The Scar → The Expanse → Vertical Megacity + Renegade Bike**.

The current prototype tests the new core thesis: overwhelming opposition is not the failure state — it is the progression system. Regional Pressure escalates visible enemy mobilization while Refusal adapts the Renegade into increasingly superhuman movement and firepower. WORLD SPINE v0.1 extends that loop across one continuous journey, adds region-driven lighting, more reliable megastructure collision, and the first third-person Renegade Bike traversal prototype.

## Quick start

```bash
npm install
npm run dev
```

For LAN testing from another device:

```bash
npm run dev:lan
```

## USB controller support

Standard browser Gamepad API controllers are supported alongside keyboard/mouse. The default Xbox/PlayStation-style mapping is documented in [`CONTROLLER_NOTES.md`](./CONTROLLER_NOTES.md). A controller can start the game directly from the title screen without requiring pointer lock.

## Production build

```bash
npm run build
npm run preview
```

## Deployment

The repo is connected to the **apex-renegade** Vercel project. See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

Pushes to `main` are the production iteration path; branches and pull requests can be used for preview deployments. The current production target is **WORLD SPINE v0.1**.

## Stack

- Three.js `0.185.1`
- WebGPURenderer + TSL
- Rapier3D
- Vite 5

## Visual direction

Spectral / dimensional / containment / renegade. Graphite, black metal, cool stone and pale environmental illumination form the baseline; violet is reserved for active spectral phenomena.
