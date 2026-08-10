import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { bus } from './core/GameState.js';
import { PlayerController } from './player/PlayerController.js';
import { PlayerCamera } from './player/PlayerCamera.js';
import { WeaponSystem } from './player/WeaponSystem.js';
import { RefusalSystem } from './player/RefusalSystem.js';
import { RenegadeBike } from './player/RenegadeBike.js';
import { LevelManager } from './world/LevelManager.js';
import { HUD } from './ui/HUD.js';
import { MenuSystem } from './ui/MenuSystem.js';
import { PostFX } from './fx/PostFX.js';
import { Particles } from './fx/Particles.js';
import { ImpactDecals } from './fx/ImpactDecals.js';
import { WorldAtmosphere } from './fx/WorldAtmosphere.js';
import { WeaponViewmodel } from './player/WeaponViewmodel.js';
import { ShooterReleaseFoundation } from './game/ShooterReleaseFoundation.js';
import { createProceduralMaterials } from './world/ProceduralMaterials.js';

function installRemainingReleaseControls(release, input) {
  const mouseKey = 'apex.mouseBindings.v1';
  let mouse = { fire: 0, aim: 2 };
  try { mouse = { ...mouse, ...JSON.parse(localStorage.getItem(mouseKey) || '{}') }; } catch {}

  const baseMouseDown = input.isMouseDown.bind(input);
  input.isMouseDown = (button = 0) => {
    if (button === 0) return input.mouseButtons.has(Number(mouse.fire)) || (input._actionButtonValue?.('fire') || 0) > .18;
    if (button === 2) return input.mouseButtons.has(Number(mouse.aim)) || (input._actionButtonValue?.('aim') || 0) > .18;
    return baseMouseDown(button);
  };
  input.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  const root = document.querySelector('#release-settings');
  if (!root || root.querySelector('#release-final-controls')) return;
  const block = document.createElement('div');
  block.id = 'release-final-controls';
  block.className = 'release-section';
  block.innerHTML = `
    <h3>Mouse & Render Timing</h3>
    <div class="setting-row"><label>Mouse Fire Button</label><input id="release-mouse-fire" type="range" min="0" max="2" step="1"><span class="setting-value" id="release-mouse-fire-value"></span></div>
    <div class="setting-row"><label>Mouse Aim Button</label><input id="release-mouse-aim" type="range" min="0" max="2" step="1"><span class="setting-value" id="release-mouse-aim-value"></span></div>
    <div class="setting-row"><label>Render Frame Cap</label><input id="release-frame-cap" type="range" min="0" max="120" step="30"><span class="setting-value" id="release-frame-cap-value"></span></div>
    <div class="release-info">Mouse buttons: 0 Left · 1 Middle · 2 Right. Frame cap 0 = uncapped. VSync remains browser-compositor controlled in this web build.</div>`;
  const display = root.querySelector('#release-display')?.closest('.release-section');
  (display || root).appendChild(block);

  const fire = block.querySelector('#release-mouse-fire');
  const aim = block.querySelector('#release-mouse-aim');
  const cap = block.querySelector('#release-frame-cap');
  const fireOut = block.querySelector('#release-mouse-fire-value');
  const aimOut = block.querySelector('#release-mouse-aim-value');
  const capOut = block.querySelector('#release-frame-cap-value');
  const label = (n) => ['LEFT','MIDDLE','RIGHT'][Number(n)] || 'LEFT';
  const sync = () => {
    fire.value = mouse.fire; aim.value = mouse.aim; cap.value = Number(release.settings.frameCap) || 0;
    fireOut.textContent = label(mouse.fire); aimOut.textContent = label(mouse.aim);
    capOut.textContent = Number(cap.value) === 0 ? 'UNCAPPED' : `${cap.value} FPS`;
  };
  const saveMouse = () => { try { localStorage.setItem(mouseKey, JSON.stringify(mouse)); } catch {} };
  fire.addEventListener('input', () => { mouse.fire = Number(fire.value); if (mouse.fire === mouse.aim) mouse.aim = mouse.fire === 2 ? 0 : 2; saveMouse(); sync(); });
  aim.addEventListener('input', () => { mouse.aim = Number(aim.value); if (mouse.aim === mouse.fire) mouse.fire = mouse.aim === 0 ? 2 : 0; saveMouse(); sync(); });
  cap.addEventListener('input', () => { release.setSetting('frameCap', Number(cap.value)); sync(); });
  sync();
}

async function boot() {
  const container = document.getElementById('app');
  const engine = new Engine(container);
  await engine.initRenderer();
  await engine.initPhysics();

  const input = new InputManager(engine.renderer.domElement);
  const hud = new HUD();

  const player = new PlayerController(engine, input);
  const playerCamera = new PlayerCamera(engine.camera, player);
  playerCamera.baseFov = input.settings.fov;
  playerCamera.targetFov = input.settings.fov;

  const particles = new Particles(engine, engine.camera);
  const impactDecals = new ImpactDecals(engine);
  const atmosphere = new WorldAtmosphere(engine);
  const sharedMaterials = createProceduralMaterials(engine.renderer);
  const weaponViewmodel = new WeaponViewmodel(engine, engine.camera, sharedMaterials);
  const levelManager = new LevelManager(engine, player);
  const weaponSystem = new WeaponSystem(engine, input, engine.camera, player, levelManager);
  const refusalSystem = new RefusalSystem(player);
  const bike = new RenegadeBike(engine, input, player, sharedMaterials);
  const postfx = new PostFX(engine);

  bus.on('recoil', ({ pitch, yaw }) => playerCamera.addRecoil(pitch, yaw));
  bus.on('blastModeStart', () => {
    playerCamera.setFovPunch(input.settings.fov + 10);
    input.pulseGamepad(180, .52, .30);
  });
  bus.on('blastModeEnd', () => playerCamera.setFovPunch(input.settings.fov));
  bus.on('refusalTier', (tier) => {
    playerCamera.setFovPunch(input.settings.fov + tier * 1.6);
    input.pulseGamepad(220, .48, .36);
  });
  bus.on('weaponFired', () => input.pulseGamepad(42, .10, .045));
  bus.on('playerDamaged', ({ amount }) => input.pulseGamepad(90, .18, Math.min(.42, .12 + amount * .009)));
  bus.on('bikeDismounted', () => weaponSystem._announce());

  engine.setRenderFn((dt) => postfx.render(dt));

  let releaseFoundation = null;

  engine.onFixedUpdate((fixedDt) => {
    bike.fixedUpdate(fixedDt);
    if (player.vehicleMounted) player.yaw = bike.heading;
    player.fixedUpdate(fixedDt);
  });

  engine.onUpdate((dt) => {
    input.update();
    playerCamera.baseFov = Number(input.settings.fov) || 92;
    const mouseDelta = input.consumeMouseDelta();
    player.updateLook(mouseDelta);
    bike.update(dt);
    playerCamera.update(dt);
    weaponSystem.update(dt);
    refusalSystem.update(dt);
    levelManager.update(dt);
    particles.update(dt);
    impactDecals.update(dt);
    atmosphere.update(dt);
    weaponViewmodel.root.visible = !player.vehicleMounted;
    weaponViewmodel.update(dt, player);
    hud.update(dt, player, input);
    postfx.update(dt);
    releaseFoundation?.update(dt);
  });

  new MenuSystem(input, engine, hud, () => {
    const start = levelManager.loadCurrent();
    player.teleport(start);
    releaseFoundation?.start();
    engine.start();
  });

  releaseFoundation = new ShooterReleaseFoundation({
    engine,
    input,
    hud,
    player,
    playerCamera,
    weaponSystem,
    weaponViewmodel,
    levelManager,
    postfx,
    bike
  });
  installRemainingReleaseControls(releaseFoundation, input);

  console.log('%cAPEX — World Spine v0.1 / Shooter Release Foundation v0.3', 'color:#9c8cff;font-weight:bold;');
}

boot().catch((err) => {
  console.error('Boot failed:', err);
  const el = document.getElementById('boot-screen');
  if (el) el.innerHTML = `<div style="color:#ff2d6e;max-width:600px;padding:2rem;">Boot error: ${err.message}<br/>Check the console.</div>`;
});
