# Apex Renegade

A fast, spectral open-world character-action FPS built with Three.js, WebGPU/TSL, Vite, and Rapier.

Current baseline: **Pass VI — Open War Sandbox / Refusal Prototype**.

The current prototype tests the new core thesis: overwhelming opposition is not the failure state — it is the progression system. Regional Pressure escalates visible enemy mobilization while Refusal adapts the Renegade into increasingly superhuman movement and firepower.

## Quick start

```bash
npm install
npm run dev
```

For LAN testing from another device:

```bash
npm run dev:lan
```

## Production build

```bash
npm run build
npm run preview
```

## Deployment

The repo is connected to the **apex-renegade** Vercel project. See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

Pushes to `main` are the production iteration path; branches and pull requests can be used for preview deployments.

## Stack

- Three.js `0.185.1`
- WebGPURenderer + TSL
- Rapier3D
- Vite 5

## Visual direction

Spectral / dimensional / containment / renegade. Graphite, black metal, cool stone and pale environmental illumination form the baseline; violet is reserved for active spectral phenomena.
