# Apex Renegade — fast iteration setup

## Local development

```bash
npm install
npm run dev
```

Vite listens on all interfaces, so another device on your LAN can use the network URL printed by Vite.

## GitHub -> Vercel workflow

1. Push this folder to the `main` branch of the Apex Renegade GitHub repository.
2. Import that repository into Vercel once.
3. Keep Vercel's detected framework as **Vite**.
4. Production branch: `main`.
5. After that:
   - every push to `main` creates/updates Production;
   - branches and pull requests receive Preview Deployments.

No environment variables are currently required.

## Build settings

These are also committed in `vercel.json`:

- Install: `npm install`
- Build: `npm run build`
- Output: `dist`
- Node: 20 (`.nvmrc`)

## WebGPU testing

Production/preview deployments use HTTPS, which is the correct context for WebGPU-capable browsers. The renderer retains its WebGL2 fallback path where WebGPU is unavailable.
