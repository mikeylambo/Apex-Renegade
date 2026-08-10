import * as THREE from 'three/webgpu';
import { bus, GameState } from '../core/GameState.js';

const SETTINGS_KEY = 'apex.releaseSettings.v3';
const KEYBINDS_KEY = 'apex.keyboardBindings.v3';

const DEFAULTS = Object.freeze({
  aimAssist: 0.48,
  aimAssistAds: 0.72,
  outerDeadzone: 0.96,
  lookAcceleration: 0.18,
  toggleAim: false,
  toggleCrouch: false,
  toggleSprint: false,
  autoSprint: false,
  vibrationIntensity: 1.0,
  cameraShake: 0.82,
  headBob: 0.72,
  weaponBob: 0.85,
  cameraRoll: 0.78,
  screenEffects: 0.90,
  masterVolume: 0.85,
  sfxVolume: 0.95,
  musicVolume: 0.22,
  dialogueVolume: 0.85,
  subtitles: true,
  directionalIndicators: true,
  renderScale: 1.0,
  shadows: true,
  postFX: true,
  frameCap: 0,
  performancePreset: 'QUALITY'
});

const DEFAULT_KEYBINDS = Object.freeze({
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  reload: 'KeyR',
  dash: 'KeyQ',
  surge: 'KeyF',
  sprint: 'ShiftLeft',
  flight: 'KeyE',
  bike: 'KeyV',
  weapon1: 'Digit1',
  weapon2: 'Digit2'
});

const CANONICAL_ACTION = Object.freeze({
  KeyW: 'moveForward', KeyS: 'moveBack', KeyA: 'moveLeft', KeyD: 'moveRight',
  Space: 'jump', ControlLeft: 'crouch', KeyC: 'crouch', KeyR: 'reload',
  KeyQ: 'dash', KeyF: 'surge', ShiftLeft: 'sprint', KeyE: 'flight', KeyV: 'bike',
  Digit1: 'weapon1', Digit2: 'weapon2'
});

const CONTROLLER_ACTION = Object.freeze({
  jump: 'jump', crouch: 'crouch', reload: 'reload', dash: 'dash', surge: 'surge',
  sprint: 'sprint', flight: 'flight', bike: 'bike'
});

const ACTION_LABELS = Object.freeze({
  moveForward: 'Move Forward', moveBack: 'Move Back', moveLeft: 'Move Left', moveRight: 'Move Right',
  jump: 'Jump', crouch: 'Crouch / Slide', reload: 'Reload', dash: 'Dash', surge: 'Apex Surge',
  sprint: 'Sprint', flight: 'Flight Toggle', bike: 'Mount / Dismount', weapon1: 'Weapon 1', weapon2: 'Weapon 2'
});

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function angleDelta(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
function cardinal(deg) {
  const names = ['N','NE','E','SE','S','SW','W','NW'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
function prettyKey(code) {
  if (!code) return 'UNBOUND';
  return code.replace('Key','').replace('Digit','').replace('ControlLeft','L CTRL').replace('ShiftLeft','L SHIFT').replace('Space','SPACE');
}

class SynthShooterAudio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.dialogue = null;
    this.noiseBuffer = null;
    this.started = false;
  }

  start() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.dialogue = this.ctx.createGain();
      this.sfx.connect(this.master); this.music.connect(this.master); this.dialogue.connect(this.master); this.master.connect(this.ctx.destination);
      this._makeNoise();
      this._startAmbient();
    }
    this.ctx.resume?.();
    this.started = true;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(clamp(this.settings.masterVolume, 0, 1), now, .02);
    this.sfx.gain.setTargetAtTime(clamp(this.settings.sfxVolume, 0, 1), now, .02);
    this.music.gain.setTargetAtTime(clamp(this.settings.musicVolume, 0, 1) * .18, now, .04);
    this.dialogue.gain.setTargetAtTime(clamp(this.settings.dialogueVolume, 0, 1), now, .02);
  }

  _makeNoise() {
    const n = Math.floor(this.ctx.sampleRate * 1.2);
    this.noiseBuffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  }

  _startAmbient() {
    const now = this.ctx.currentTime;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = .02;
    this.ambientGain.connect(this.music);
    [54.6, 81.9].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = i ? 'triangle' : 'sine';
      o.frequency.value = freq;
      g.gain.value = i ? .18 : .27;
      o.connect(g); g.connect(this.ambientGain); o.start(now);
    });
  }

  tone(freq = 440, duration = .08, gain = .08, type = 'sine', pan = 0, delay = 0) {
    if (!this.ctx || !this.started) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner?.();
    osc.type = type; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(28, freq * .72), now + duration);
    g.gain.setValueAtTime(Math.max(.0001, gain), now); g.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(g); if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    osc.start(now); osc.stop(now + duration + .02);
  }

  noise(duration = .08, gain = .07, cutoff = 1800, pan = 0, delay = 0) {
    if (!this.ctx || !this.started || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner?.();
    src.buffer = this.noiseBuffer; f.type = 'bandpass'; f.frequency.value = cutoff; f.Q.value = .7;
    g.gain.setValueAtTime(Math.max(.0001, gain), now); g.gain.exponentialRampToValueAtTime(.0001, now + duration);
    src.connect(f); f.connect(g); if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    src.start(now); src.stop(now + duration + .01);
  }

  gun() { this.noise(.055,.13,1450); this.tone(96,.09,.10,'sawtooth'); this.noise(.16,.035,540,.0,.035); this.tone(42,.22,.035,'sine',0,.025); }
  hit() { this.tone(1220,.035,.045,'square'); }
  kill() { this.tone(720,.06,.065,'triangle'); this.tone(1080,.08,.05,'sine',0,.035); }
  dry() { this.tone(1900,.025,.035,'square'); this.noise(.025,.025,3200); }
  reload() { this.tone(460,.035,.03,'square'); this.tone(710,.03,.025,'triangle',0,.10); }
  damage(pan = 0) { this.noise(.10,.08,620,pan); this.tone(74,.14,.055,'sine',pan); }
  impact(metal = false, pan = 0) { this.noise(.045,.045,metal ? 2300 : 850,pan); if (metal) this.tone(1560,.06,.025,'triangle',pan); }
  footstep() { this.noise(.045,.018,240); }
  boost() { this.noise(.18,.06,420); this.tone(64,.24,.055,'sawtooth'); }
}

export class ShooterReleaseFoundation {
  constructor({ engine, input, hud, player, playerCamera, weaponSystem, weaponViewmodel, levelManager, postfx, bike }) {
    this.engine = engine;
    this.input = input;
    this.hud = hud;
    this.player = player;
    this.playerCamera = playerCamera;
    this.weaponSystem = weaponSystem;
    this.weaponViewmodel = weaponViewmodel;
    this.levelManager = levelManager;
    this.postfx = postfx;
    this.bike = bike;

    this.settings = loadJSON(SETTINGS_KEY, DEFAULTS);
    this.keybinds = loadJSON(KEYBINDS_KEY, DEFAULT_KEYBINDS);
    this.audio = new SynthShooterAudio(this.settings);
    this._toggles = { aim:false, crouch:false, sprint:false };
    this._prevRaw = { aim:false, crouch:false, sprint:false };
    this._equipPulse = 0;
    this._landPulse = 0;
    this._wasGrounded = player.grounded;
    this._dryCooldown = 0;
    this._footstepTimer = 0;
    this._region = 'THE SCAR';
    this._objective = new THREE.Vector3(0, 650, -4150);
    this._lastRender = 0;
    this._captureKeyAction = null;

    this._installStylesAndHUD();
    this._patchInput();
    this._patchCombatFeedback();
    this._patchCameraComfort();
    this._patchRendering();
    this._bindEvents();
    this._extendSettingsMenu();
    this.applySettings();
  }

  start() { this.audio.start(); }

  setSetting(key, value) {
    if (!(key in DEFAULTS)) return;
    this.settings[key] = value;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.applySettings();
    this._syncReleaseSettingsUI();
  }

  resetSettings() {
    this.settings = { ...DEFAULTS };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.applySettings();
    this._syncReleaseSettingsUI();
  }

  setKeybind(action, code) {
    if (!(action in DEFAULT_KEYBINDS)) return;
    const old = this.keybinds[action];
    const conflict = Object.entries(this.keybinds).find(([other, c]) => other !== action && c === code)?.[0];
    if (conflict) this.keybinds[conflict] = old;
    this.keybinds[action] = code;
    try { localStorage.setItem(KEYBINDS_KEY, JSON.stringify(this.keybinds)); } catch {}
    this._syncKeybindUI();
  }

  resetKeybinds() {
    this.keybinds = { ...DEFAULT_KEYBINDS };
    try { localStorage.setItem(KEYBINDS_KEY, JSON.stringify(this.keybinds)); } catch {}
    this._syncKeybindUI();
  }

  applySettings() {
    this.audio.applyVolumes();
    const intensity = clamp(Number(this.settings.vibrationIntensity) || 0, 0, 1);
    this._vibrationIntensity = intensity;
    const scale = clamp(Number(this.settings.renderScale) || 1, .5, 1.5);
    this.engine.renderer.setPixelRatio(Math.min(window.devicePixelRatio * scale, 2));
    this.engine.renderer.setSize(window.innerWidth, window.innerHeight);
    this.engine.renderer.shadowMap.enabled = !!this.settings.shadows;
    document.documentElement.style.setProperty('--release-screen-fx', String(clamp(this.settings.screenEffects, 0, 1)));
  }

  update(dt) {
    if (!this.player || !this.weaponSystem) return;
    this._dryCooldown = Math.max(0, this._dryCooldown - dt);
    this._equipPulse = THREE.MathUtils.damp(this._equipPulse, 0, 7.5, dt);
    this._landPulse = THREE.MathUtils.damp(this._landPulse, 0, 9, dt);

    this._updateAimAssist(dt);
    this._updateADSAndWeaponPose(dt);
    this._updateCompass();
    this._updateFootsteps(dt);
    this._updateDryFire();
    this._updateLanding();
  }

  _installStylesAndHUD() {
    const style = document.createElement('style');
    style.id = 'apex-release-foundation-style';
    style.textContent = `
      #release-hitmarker{position:fixed;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%) scale(.8);z-index:24;pointer-events:none;opacity:0;transition:opacity .06s linear,transform .07s ease}.hm{position:absolute;width:8px;height:2px;background:#f4f7fb;box-shadow:0 0 5px rgba(255,255,255,.35)}.hm.a{left:3px;top:8px;transform:rotate(45deg)}.hm.b{right:3px;top:8px;transform:rotate(-45deg)}.hm.c{left:3px;bottom:8px;transform:rotate(-45deg)}.hm.d{right:3px;bottom:8px;transform:rotate(45deg)}#release-hitmarker.show{opacity:1;transform:translate(-50%,-50%) scale(1)}#release-hitmarker.kill .hm{background:#a38cff;box-shadow:0 0 8px rgba(163,140,255,.9)}
      #release-killtext{position:fixed;left:50%;top:54%;transform:translateX(-50%);z-index:24;pointer-events:none;opacity:0;color:#c8bcff;font-size:.66rem;font-weight:800;letter-spacing:.24em;text-transform:uppercase;text-shadow:0 0 10px rgba(118,103,245,.7);transition:opacity .12s ease}#release-killtext.show{opacity:1}
      #release-damage-arrow{position:fixed;left:50%;top:50%;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:18px solid rgba(255,74,112,.9);filter:drop-shadow(0 0 5px rgba(212,20,90,.65));transform-origin:50% 105px;z-index:23;pointer-events:none;opacity:0;transition:opacity .12s ease}#release-damage-arrow.show{opacity:calc(.95 * var(--release-screen-fx,1))}
      #release-lowhp{position:fixed;inset:0;z-index:16;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,transparent 42%,rgba(166,9,49,.42) 100%);transition:opacity .18s ease}#release-lowhp.show{opacity:calc(.8 * var(--release-screen-fx,1));animation:releasePulse 1.05s ease-in-out infinite}@keyframes releasePulse{0%,100%{filter:brightness(.78)}50%{filter:brightness(1.24)}}
      #release-compass{position:fixed;left:50%;top:5.1rem;transform:translateX(-50%);z-index:23;width:min(430px,70vw);height:42px;pointer-events:none;color:#e8edf4;text-align:center;text-shadow:0 1px 8px rgba(0,0,0,.8)}#release-heading{font-size:.68rem;letter-spacing:.23em;font-weight:800}#release-region{font-size:.55rem;letter-spacing:.2em;color:#92a4b8;margin-top:.2rem}#release-objective{position:absolute;top:30px;left:50%;transform:translateX(-50%);font-size:.56rem;letter-spacing:.16em;color:#e9a14b;white-space:nowrap;transition:left .08s linear}
      .release-section{margin:1.7rem 0 2.2rem}.release-section h3{font-size:.75rem;letter-spacing:.25em;text-transform:uppercase;color:#92a4b8;margin:0 0 .8rem}.release-info{font-size:.68rem;color:rgba(232,237,244,.48);letter-spacing:.08em;line-height:1.55;margin:.5rem 0}.release-cycle{min-width:190px;text-align:center}.release-kbind-grid{display:grid;grid-template-columns:1fr 1fr;gap:.45rem .8rem}.release-kbind{display:grid;grid-template-columns:1fr 120px;align-items:center;gap:.65rem;border-bottom:1px solid rgba(232,237,244,.07);padding:.4rem 0}.release-kbind span{font-size:.74rem;letter-spacing:.07em;text-transform:uppercase}
      @media(max-width:680px){.release-kbind-grid{grid-template-columns:1fr}#release-compass{top:4.6rem}}
    `;
    document.head.appendChild(style);

    const hit = document.createElement('div'); hit.id = 'release-hitmarker'; hit.innerHTML = '<i class="hm a"></i><i class="hm b"></i><i class="hm c"></i><i class="hm d"></i>'; document.body.appendChild(hit); this.hitmarker = hit;
    const kill = document.createElement('div'); kill.id = 'release-killtext'; kill.textContent = 'HOSTILE DOWN'; document.body.appendChild(kill); this.killtext = kill;
    const arrow = document.createElement('div'); arrow.id = 'release-damage-arrow'; document.body.appendChild(arrow); this.damageArrow = arrow;
    const low = document.createElement('div'); low.id = 'release-lowhp'; document.body.appendChild(low); this.lowHP = low;
    const compass = document.createElement('div'); compass.id = 'release-compass'; compass.innerHTML = '<div id="release-heading">N // 000°</div><div id="release-region">THE SCAR</div><div id="release-objective">▲ VERTICAL MEGACITY</div>'; document.body.appendChild(compass);
    this.headingEl = compass.querySelector('#release-heading'); this.regionEl = compass.querySelector('#release-region'); this.objectiveEl = compass.querySelector('#release-objective');
  }

  _patchInput() {
    this._baseIsDown = this.input.isDown.bind(this.input);
    this._baseIsMouseDown = this.input.isMouseDown.bind(this.input);
    this._basePulse = this.input.pulseGamepad.bind(this.input);
    this._baseCurvedAxis = this.input._curvedAxis.bind(this.input);

    this.input._curvedAxis = (value, zone = .12, exponent = 1.55) => {
      const outer = clamp(Number(this.settings.outerDeadzone) || .96, .72, 1);
      const a = Math.abs(value);
      if (a <= zone) return 0;
      let n = clamp((a - zone) / Math.max(.001, outer - zone), 0, 1);
      n = Math.pow(n, exponent);
      const accel = clamp(Number(this.settings.lookAcceleration) || 0, 0, 1);
      n *= 1 + accel * Math.pow(n, 2) * .55;
      return Math.sign(value) * clamp(n, -1, 1);
    };

    this.input.pulseGamepad = (duration, weak, strong) => {
      const k = clamp(Number(this.settings.vibrationIntensity) || 0, 0, 1);
      return this._basePulse(duration, (weak || 0) * k, (strong || 0) * k);
    };

    this.input.isDown = (code) => {
      const action = CANONICAL_ACTION[code];
      if (!action) return this._baseIsDown(code);
      return this._effectiveActionDown(action);
    };

    this.input.isMouseDown = (button = 0) => {
      if (button === 0) return this._effectiveActionDown('fire');
      if (button === 2) return this._effectiveActionDown('aim');
      return this._baseIsMouseDown(button);
    };
  }

  _rawActionDown(action) {
    const kbCode = this.keybinds[action];
    if (kbCode && this.input.keys.has(kbCode)) return true;
    if (action === 'fire') return this.input.mouseButtons.has(0) || this.input._actionButtonValue?.('fire') > .18;
    if (action === 'aim') return this.input.mouseButtons.has(2) || this.input._actionButtonValue?.('aim') > .18;
    if (action === 'moveForward') return this.input.keys.has(this.keybinds.moveForward) || this.input._axis?.(1) < -.38;
    if (action === 'moveBack') return this.input.keys.has(this.keybinds.moveBack) || this.input._axis?.(1) > .38;
    if (action === 'moveLeft') return this.input.keys.has(this.keybinds.moveLeft) || this.input._axis?.(0) < -.38;
    if (action === 'moveRight') return this.input.keys.has(this.keybinds.moveRight) || this.input._axis?.(0) > .38;
    const controller = CONTROLLER_ACTION[action];
    if (controller && this.input._actionDown?.(controller)) return true;
    return false;
  }

  _effectiveActionDown(action) {
    const raw = this._rawActionDown(action);
    if (action === 'aim' && this.settings.toggleAim) return this._toggleState('aim', raw);
    if (action === 'crouch' && this.settings.toggleCrouch) return this._toggleState('crouch', raw);
    if (action === 'sprint') {
      if (this.settings.autoSprint && this._rawActionDown('moveForward') && !this._effectiveActionDown('crouch')) return true;
      if (this.settings.toggleSprint) return this._toggleState('sprint', raw);
    }
    return raw;
  }

  _toggleState(action, raw) {
    if (raw && !this._prevRaw[action]) this._toggles[action] = !this._toggles[action];
    this._prevRaw[action] = raw;
    return this._toggles[action];
  }

  _patchCombatFeedback() {
    const baseHitscan = this.weaponSystem.hitscan.bind(this.weaponSystem);
    this.weaponSystem.hitscan = (...args) => {
      const results = baseHitscan(...args) || [];
      if (results.length) {
        const kills = results.filter((r) => r.target?.dead).length;
        bus.emit('hitConfirmed', { count: results.length, kills, critical: results.some((r) => r.target?.lastHitCritical) });
      }
      return results;
    };
  }

  _patchCameraComfort() {
    const baseRecoil = this.playerCamera.addRecoil.bind(this.playerCamera);
    this.playerCamera.addRecoil = (pitch, yaw) => {
      const k = clamp(Number(this.settings.cameraShake) || 0, 0, 1.5);
      baseRecoil(pitch * k, yaw * k);
    };

    const baseUpdate = this.playerCamera.update.bind(this.playerCamera);
    this.playerCamera.update = (dt) => {
      baseUpdate(dt);
      if (this.player.vehicleMounted) return;
      const eye = this.player.getEyePosition();
      const bob = clamp(Number(this.settings.headBob) || 0, 0, 1);
      const roll = clamp(Number(this.settings.cameraRoll) || 0, 0, 1);
      this.engine.camera.position.x = THREE.MathUtils.lerp(eye.x, this.engine.camera.position.x, bob);
      this.engine.camera.position.y = THREE.MathUtils.lerp(eye.y, this.engine.camera.position.y, bob);
      this.engine.camera.position.z = THREE.MathUtils.lerp(eye.z, this.engine.camera.position.z, bob);
      this.engine.camera.rotation.z *= roll;
    };
  }

  _patchRendering() {
    this._baseRenderFn = this.engine.renderFn;
    this.engine.setRenderFn((dt, alpha) => {
      const cap = Number(this.settings.frameCap) || 0;
      const now = performance.now();
      if (cap > 0 && now - this._lastRender < 1000 / cap) return;
      this._lastRender = now;
      if (this.settings.postFX) this._baseRenderFn?.(dt, alpha);
      else this.engine.renderer.render(this.engine.scene, this.engine.camera);
    });
  }

  _bindEvents() {
    bus.on('weaponFired', () => this.audio.gun());
    bus.on('reloadStart', () => this.audio.reload());
    bus.on('worldHit', ({ object }) => this.audio.impact((object?.material?.metalness || 0) > .45));
    bus.on('hitConfirmed', ({ kills }) => this._showHitmarker(kills > 0));
    bus.on('bikeBoost', () => this.audio.boost());
    bus.on('weaponChanged', () => { this._equipPulse = 1; });
    bus.on('regionChanged', ({ name }) => { this._region = name; if (this.regionEl) this.regionEl.textContent = name; });
    bus.on('playerHealth', (pct) => this.lowHP?.classList.toggle('show', pct <= .30));
    bus.on('enemyAttack', () => this._directionalDamage());
    bus.on('playerDamaged', () => this._directionalDamage());
  }

  _showHitmarker(kill) {
    this.hitmarker.classList.toggle('kill', kill);
    this.hitmarker.classList.add('show');
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => this.hitmarker.classList.remove('show'), kill ? 135 : 85);
    if (kill) {
      this.killtext.classList.add('show');
      clearTimeout(this._killTimer);
      this._killTimer = setTimeout(() => this.killtext.classList.remove('show'), 430);
      this.audio.kill();
    } else this.audio.hit();
  }

  _nearestEnemy() {
    const enemies = this.levelManager.getEnemies?.() || [];
    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (!e || e.dead || !e.mesh?.position) continue;
      const d = e.mesh.position.distanceToSquared(this.player.position);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  _directionalDamage() {
    if (!this.settings.directionalIndicators) return;
    const enemy = this._nearestEnemy();
    let rel = 0;
    if (enemy) {
      const d = enemy.mesh.position.clone().sub(this.player.position);
      const bearing = Math.atan2(d.x, -d.z);
      rel = angleDelta(this.player.yaw, bearing);
    }
    const deg = THREE.MathUtils.radToDeg(rel);
    this.damageArrow.style.transform = `translate(-50%,-105px) rotate(${deg}deg)`;
    this.damageArrow.classList.add('show');
    clearTimeout(this._damageArrowTimer);
    this._damageArrowTimer = setTimeout(() => this.damageArrow.classList.remove('show'), 380);
    this.audio.damage(Math.sin(rel));
  }

  _updateAimAssist(dt) {
    if (!this.input.hasGamepad() || this.player.vehicleMounted) return;
    const strengthBase = clamp(Number(this.settings.aimAssist) || 0, 0, 1);
    if (strengthBase <= 0) return;
    const rx = this.input._axis?.(2) || 0, ry = this.input._axis?.(3) || 0;
    const stickMag = Math.hypot(rx, ry);
    const ads = this.input.isMouseDown(2);
    const zone = Number(this.input.settings?.rightStickDeadzone) || .19;
    if (!ads && stickMag <= zone + .035) return;

    const camera = this.engine.camera;
    let best = null, bestScore = Infinity;
    for (const e of this.levelManager.getEnemies?.() || []) {
      if (!e || e.dead || !e.mesh?.position) continue;
      const world = e.mesh.position.clone(); world.y += 1.1;
      const ndc = world.clone().project(camera);
      if (ndc.z < -1 || ndc.z > 1) continue;
      const score = ndc.x * ndc.x + ndc.y * ndc.y * 1.25;
      const cone = ads ? .12 : .065;
      if (score < cone * cone && score < bestScore) { bestScore = score; best = world; }
    }
    if (!best) return;

    const origin = camera.getWorldPosition(new THREE.Vector3());
    const dir = best.sub(origin).normalize();
    const desiredYaw = Math.atan2(-dir.x, -dir.z);
    const desiredPitch = -Math.asin(clamp(dir.y, -1, 1));
    const strength = strengthBase * (ads ? clamp(Number(this.settings.aimAssistAds) || .72, 0, 1.5) : .48) * (2.2 + stickMag * 2.4) * dt;
    this.player.yaw += angleDelta(this.player.yaw, desiredYaw) * clamp(strength, 0, .24);
    this.player.pitch += (desiredPitch - this.player.pitch) * clamp(strength * .72, 0, .18);
  }

  _updateADSAndWeaponPose(dt) {
    const aiming = this.input.isMouseDown(2) && !this.player.vehicleMounted;
    if (!this.player.vehicleMounted) {
      const targetFov = aiming ? (Number(this.input.settings?.fov) || 92) * .84 : (Number(this.input.settings?.fov) || 92);
      this.engine.camera.fov = THREE.MathUtils.damp(this.engine.camera.fov, targetFov, aiming ? 14 : 10, dt);
      this.engine.camera.updateProjectionMatrix();
    }

    const root = this.weaponViewmodel?.root;
    if (!root || !root.visible) return;
    const bob = clamp(Number(this.settings.weaponBob) || 0, 0, 1);
    root.position.x *= bob;
    root.position.y *= bob;
    root.position.y -= this._equipPulse * .32;
    root.position.y += this._landPulse * -.11;

    const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    const sprinting = this.input.isDown('ShiftLeft') && speed > 5.5 && !aiming;
    if (sprinting) {
      root.position.y -= .10;
      root.position.z += .10;
      root.rotation.x = THREE.MathUtils.damp(root.rotation.x, .16, 10, dt);
      root.rotation.z = THREE.MathUtils.damp(root.rotation.z, -.055, 10, dt);
    } else {
      root.rotation.x = THREE.MathUtils.damp(root.rotation.x, 0, 12, dt);
      root.rotation.z = THREE.MathUtils.damp(root.rotation.z, 0, 12, dt);
    }
    if (this.player.sliding) { root.position.y -= .13; root.rotation.z += .07; }

    const amount = aiming ? 1 : 0;
    if (this.weaponViewmodel.leftArm && this.weaponViewmodel.rightArm) {
      this.weaponViewmodel.leftArm.position.x += .19 * amount;
      this.weaponViewmodel.rightArm.position.x -= .19 * amount;
      this.weaponViewmodel.leftArm.position.y += .055 * amount;
      this.weaponViewmodel.rightArm.position.y += .055 * amount;
      this.weaponViewmodel.leftArm.position.z -= .055 * amount;
      this.weaponViewmodel.rightArm.position.z -= .055 * amount;
    }
  }

  _updateDryFire() {
    if (this._dryCooldown > 0 || this.player.vehicleMounted) return;
    const active = this.weaponSystem.active;
    if (!active || active._reloading || !this.input.isMouseDown(0)) return;
    if (typeof active.ammo === 'number' && active.ammo <= 0 && (!active.reserve || active.reserve <= 0)) {
      this._dryCooldown = .27;
      this.audio.dry();
      bus.emit('dryFire', { name: active.name });
    }
  }

  _updateLanding() {
    const grounded = this.player.grounded;
    if (grounded && !this._wasGrounded && Math.abs(this.player.velocity.y) > 1.5) this._landPulse = 1;
    this._wasGrounded = grounded;
  }

  _updateFootsteps(dt) {
    if (!this.player.grounded || this.player.vehicleMounted) return;
    const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    if (speed < 2) { this._footstepTimer = 0; return; }
    this._footstepTimer -= dt;
    if (this._footstepTimer <= 0) {
      this.audio.footstep();
      this._footstepTimer = speed > 8 ? .28 : .42;
    }
  }

  _updateCompass() {
    if (!this.headingEl) return;
    const deg = (((THREE.MathUtils.radToDeg(this.player.yaw) % 360) + 360) % 360);
    this.headingEl.textContent = `${cardinal(deg)} // ${String(Math.round(deg)).padStart(3,'0')}°`;
    const p = this.player.position;
    const to = this._objective.clone().sub(p);
    const distance = Math.round(Math.hypot(to.x, to.z));
    const bearing = Math.atan2(to.x, -to.z);
    const rel = THREE.MathUtils.radToDeg(angleDelta(this.player.yaw, bearing));
    const x = clamp(rel / 80, -1, 1) * 44 + 50;
    this.objectiveEl.style.left = `${x}%`;
    this.objectiveEl.textContent = `${Math.abs(rel) > 84 ? (rel < 0 ? '◀' : '▶') : '▲'} VERTICAL MEGACITY // ${distance}m`;
  }

  _extendSettingsMenu() {
    const root = document.querySelector('#settings-root');
    if (!root || root.querySelector('#release-settings')) return;
    const host = document.createElement('div'); host.id = 'release-settings';
    host.innerHTML = `
      <div class="release-section"><h3>Combat & Aim Assist</h3><div id="release-combat"></div></div>
      <div class="release-section"><h3>Camera Comfort</h3><div id="release-camera"></div><div class="release-info">Motion blur is currently OFF by design in the Three.js prototype. Camera motion, roll, recoil and screen effects can be reduced independently.</div></div>
      <div class="release-section"><h3>Audio & Captions</h3><div id="release-audio"></div></div>
      <div class="release-section"><h3>Keyboard Layout</h3><div id="release-keycapture" class="capture-note">Press a key… Escape cancels</div><div id="release-kbind-grid" class="release-kbind-grid"></div><div class="release-info">Mouse: Left Fire · Right Aim. Controller remapping remains in the section above.</div></div>
      <div class="release-section"><h3>PC Display & Performance</h3><div id="release-display"></div><div class="release-info">VSync is controlled by the browser compositor in this web build. Resolution scale, shadows, post processing and render-frame cap are exposed here; the future desktop/Steam shell can take direct control of presentation mode and sync.</div></div>
      <div class="pause-actions"><button class="apex-btn" id="release-fullscreen">Toggle Fullscreen</button><button class="apex-btn" id="release-preset">Preset: QUALITY</button><button class="apex-btn" id="release-reset">Reset Release Settings</button><button class="apex-btn" id="release-reset-keys">Reset Keyboard Layout</button></div>`;
    const footer = root.querySelector('.menu-foot');
    root.insertBefore(host, footer || null);

    this._buildSettingRows(host.querySelector('#release-combat'), [
      ['aimAssist','Aim Assist Strength',0,1,.05,2], ['aimAssistAds','ADS Assist Multiplier',.2,1.2,.05,2],
      ['outerDeadzone','Right Stick Outer Deadzone',.72,1,.01,2], ['lookAcceleration','Look Acceleration',0,1,.05,2],
      ['vibrationIntensity','Vibration Intensity',0,1,.05,2]
    ], [
      ['toggleAim','Toggle ADS'], ['toggleCrouch','Toggle Crouch'], ['toggleSprint','Toggle Sprint'], ['autoSprint','Auto Sprint'], ['directionalIndicators','Directional Damage Indicators']
    ]);
    this._buildSettingRows(host.querySelector('#release-camera'), [
      ['cameraShake','Recoil / Camera Shake',0,1.25,.05,2], ['headBob','Head Bob',0,1,.05,2], ['weaponBob','Weapon Bob',0,1,.05,2], ['cameraRoll','Camera Roll',0,1,.05,2], ['screenEffects','Screen Effects',0,1,.05,2]
    ]);
    this._buildSettingRows(host.querySelector('#release-audio'), [
      ['masterVolume','Master Volume',0,1,.05,2], ['sfxVolume','SFX Volume',0,1,.05,2], ['musicVolume','Music Volume',0,1,.05,2], ['dialogueVolume','Dialogue Volume',0,1,.05,2]
    ], [['subtitles','Subtitles / Captions']]);
    this._buildSettingRows(host.querySelector('#release-display'), [['renderScale','Resolution Scale',.5,1.5,.05,2]], [['shadows','Dynamic Shadows'],['postFX','Post Processing']]);

    const grid = host.querySelector('#release-kbind-grid');
    grid.innerHTML = Object.keys(ACTION_LABELS).map((action) => `<div class="release-kbind"><span>${ACTION_LABELS[action]}</span><button class="bind-btn" data-kbind="${action}">${prettyKey(this.keybinds[action])}</button></div>`).join('');
    grid.querySelectorAll('[data-kbind]').forEach((btn) => btn.addEventListener('click', () => this._beginKeyCapture(btn.dataset.kbind)));

    host.querySelector('#release-fullscreen').addEventListener('click', () => this._toggleFullscreen());
    host.querySelector('#release-preset').addEventListener('click', () => this._cyclePreset());
    host.querySelector('#release-reset').addEventListener('click', () => this.resetSettings());
    host.querySelector('#release-reset-keys').addEventListener('click', () => this.resetKeybinds());

    window.addEventListener('keydown', (e) => {
      if (!this._captureKeyAction) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') { this._captureKeyAction = null; this._keyCaptureNote?.classList.remove('show'); return; }
      this.setKeybind(this._captureKeyAction, e.code);
      this._captureKeyAction = null;
      if (this._keyCaptureNote) { this._keyCaptureNote.textContent = 'Keyboard mapping saved.'; setTimeout(() => this._keyCaptureNote?.classList.remove('show'), 700); }
    }, true);

    this._keyCaptureNote = host.querySelector('#release-keycapture');
    this._syncReleaseSettingsUI();
    this._syncKeybindUI();
  }

  _buildSettingRows(host, ranges = [], checks = []) {
    if (!host) return;
    host.innerHTML = ranges.map(([key,label,min,max,step]) => `<div class="setting-row"><label>${label}</label><input data-release-setting="${key}" type="range" min="${min}" max="${max}" step="${step}"><span class="setting-value" data-release-value="${key}"></span></div>`).join('') +
      checks.map(([key,label]) => `<div class="setting-row"><label>${label}</label><input data-release-setting="${key}" type="checkbox"><span></span></div>`).join('');
    host.querySelectorAll('[data-release-setting]').forEach((el) => el.addEventListener('input', () => {
      this.setSetting(el.dataset.releaseSetting, el.type === 'checkbox' ? el.checked : Number(el.value));
    }));
  }

  _syncReleaseSettingsUI() {
    const root = document.querySelector('#release-settings'); if (!root) return;
    for (const [key, value] of Object.entries(this.settings)) {
      const el = root.querySelector(`[data-release-setting="${key}"]`); if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!value; else el.value = value;
      const out = root.querySelector(`[data-release-value="${key}"]`); if (out) out.textContent = `${Math.round(Number(value) * 100)}%`;
    }
    const preset = root.querySelector('#release-preset'); if (preset) preset.textContent = `Preset: ${this.settings.performancePreset}`;
  }

  _beginKeyCapture(action) {
    this._captureKeyAction = action;
    if (this._keyCaptureNote) { this._keyCaptureNote.textContent = `${ACTION_LABELS[action]} // press a key… Escape cancels`; this._keyCaptureNote.classList.add('show'); }
  }

  _syncKeybindUI() {
    document.querySelectorAll('[data-kbind]').forEach((btn) => { btn.textContent = prettyKey(this.keybinds[btn.dataset.kbind]); });
  }

  _cyclePreset() {
    const order = ['QUALITY','BALANCED','PERFORMANCE'];
    const next = order[(order.indexOf(this.settings.performancePreset) + 1) % order.length];
    this.settings.performancePreset = next;
    if (next === 'QUALITY') { this.settings.renderScale = 1; this.settings.shadows = true; this.settings.postFX = true; }
    if (next === 'BALANCED') { this.settings.renderScale = .85; this.settings.shadows = true; this.settings.postFX = true; }
    if (next === 'PERFORMANCE') { this.settings.renderScale = .68; this.settings.shadows = false; this.settings.postFX = false; }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.applySettings(); this._syncReleaseSettingsUI();
  }

  _toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch?.(() => {});
  }
}
