# Apex Renegade — fast iteration setup

## Local development

```bash
npm install
npm run dev
```

For LAN testing from another device:

```bash
npm run dev:lan
```

## GitHub -> Vercel workflow

1. Connect this GitHub repository to the Vercel project once.
2. Keep Vercel's detected framework as **Vite**.
3. Production branch: `main`.
4. After that:
   - every push to `main` creates/updates Production;
   - branches and pull requests receive Preview Deployments.

No environment variables are currently required.

## Build settings

These are also committed in `vercel.json`:

- Install: `npm install`
- Build: `npm run build`
- Output: `dist`
- Node: 24 (`package.json` + `.nvmrc`)

## WebGPU testing

Production/preview deployments use HTTPS, which is the correct context for WebGPU-capable browsers. The renderer retains its WebGL2 fallback path where WebGPU is unavailable.
