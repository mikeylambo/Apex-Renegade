import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { bus, GameState } from './core/GameState.js';
import { PlayerController } from './player/PlayerController.js';
import { PlayerCamera } from './player/PlayerCamera.js';
import { WeaponSystem } from './player/WeaponSystem.js';
import { RefusalSystem } from './player/RefusalSystem.js';
import { LevelManager } from './world/LevelManager.js';
import { HUD } from './ui/HUD.js';
import { MenuSystem } from './ui/MenuSystem.js';
import { PostFX } from './fx/PostFX.js';
import { Particles } from './fx/Particles.js';
import { ImpactDecals } from './fx/ImpactDecals.js';
import { WorldAtmosphere } from './fx/WorldAtmosphere.js';
import { WeaponViewmodel } from './player/WeaponViewmodel.js';
import { createProceduralMaterials } from './world/ProceduralMaterials.js';

async function boot() {
  const container = document.getElementById('app');
  const engine = new Engine(container);
  await engine.initRenderer();
  await engine.initPhysics();

  const input = new InputManager(engine.renderer.domElement);
  const hud = new HUD();

  const player = new PlayerController(engine, input);
  const playerCamera = new PlayerCamera(engine.camera, player);
  const particles = new Particles(engine, engine.camera);
  const impactDecals = new ImpactDecals(engine);
  const atmosphere = new WorldAtmosphere(engine);
  const viewmodelMaterials = createProceduralMaterials(engine.renderer);
  const weaponViewmodel = new WeaponViewmodel(engine, engine.camera, viewmodelMaterials);
  const levelManager = new LevelManager(engine, player);
  const weaponSystem = new WeaponSystem(engine, input, engine.camera, player, levelManager);
  const refusalSystem = new RefusalSystem(player);
  const postfx = new PostFX(engine);

  bus.on('recoil', ({ pitch, yaw }) => playerCamera.addRecoil(pitch, yaw));
  bus.on('blastModeStart', () => playerCamera.setFovPunch(102));
  bus.on('blastModeEnd', () => playerCamera.setFovPunch(92));
  bus.on('refusalTier', (tier) => playerCamera.setFovPunch(92 + tier * 1.6));

  engine.setRenderFn((dt) => postfx.render(dt));

  engine.onFixedUpdate((fixedDt) => {
    player.fixedUpdate(fixedDt);
  });

  engine.onUpdate((dt) => {
    const mouseDelta = input.consumeMouseDelta();
    player.updateLook(mouseDelta);
    playerCamera.update(dt);
    weaponSystem.update(dt);
    refusalSystem.update(dt);
    levelManager.update(dt);
    particles.update(dt);
    impactDecals.update(dt);
    atmosphere.update(dt);
    weaponViewmodel.update(dt, player);
    postfx.update(dt);
  });

  const menu = new MenuSystem(input, engine, hud, () => {
    const start = levelManager.loadCurrent();
    player.teleport(start);
    engine.start();
  });

  // eslint-disable-next-line no-console
  console.log('%cAPEX — Open War Sandbox / Refusal Prototype', 'color:#b24bff;font-weight:bold;');
}

boot().catch((err) => {
  console.error('Boot failed:', err);
  const el = document.getElementById('boot-screen');
  if (el) el.innerHTML = `<div style="color:#ff2d6e;max-width:600px;padding:2rem;">Boot error: ${err.message}<br/>Check the console.</div>`;
});
