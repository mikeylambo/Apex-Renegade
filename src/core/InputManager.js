/**
 * Centralized keyboard / mouse / USB controller input.
 *
 * Shooter Foundation v0.2 adds persistent controller bindings plus separate
 * mouse/controller aim tuning. Keyboard/mouse remains fixed in this pass;
 * controller actions can be rebound in-game.
 */
const SETTINGS_KEY = 'apex.inputSettings.v2';
const BINDINGS_KEY = 'apex.controllerBindings.v2';

const DEFAULT_SETTINGS = Object.freeze({
  mouseSensitivity: 1.0,
  controllerSensitivityX: 1.0,
  controllerSensitivityY: 1.0,
  rightStickDeadzone: 0.19,
  rightStickCurve: 1.55,
  adsMultiplier: 0.72,
  invertControllerY: false,
  vibration: true,
  fov: 92,
  reticleScale: 1.0
});

const DEFAULT_BINDINGS = Object.freeze({
  jump: 0,          // A / Cross
  crouch: 1,        // B / Circle
  reload: 2,        // X / Square
  weaponNext: 3,    // Y / Triangle
  dash: 4,          // LB / L1
  surge: 5,         // RB / R1
  aim: 6,           // LT / L2
  fire: 7,          // RT / R2
  pause: 9,         // Menu / Options
  sprint: 10,       // L3
  flight: 12,       // D-pad Up
  bike: 13,         // D-pad Down
  weaponPrev: 14    // D-pad Left
});

const BUTTON_LABELS = [
  'A / CROSS', 'B / CIRCLE', 'X / SQUARE', 'Y / TRIANGLE',
  'LB / L1', 'RB / R1', 'LT / L2', 'RT / R2',
  'VIEW / SHARE', 'MENU / OPTIONS', 'L3', 'R3',
  'D-PAD UP', 'D-PAD DOWN', 'D-PAD LEFT', 'D-PAD RIGHT'
];

const CODE_TO_ACTION = Object.freeze({
  Space: 'jump',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
  KeyR: 'reload',
  KeyQ: 'dash',
  KeyF: 'surge',
  ShiftLeft: 'sprint',
  KeyE: 'flight',
  KeyV: 'bike'
});

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return { ...fallback };
  }
}

export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this.keys = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.mouseButtons = new Set();
    this.pointerLocked = false;
    this.wheelDelta = 0;

    this.settings = loadStored(SETTINGS_KEY, DEFAULT_SETTINGS);
    this.bindings = loadStored(BINDINGS_KEY, DEFAULT_BINDINGS);

    this.gamepadIndex = null;
    this.gamepad = null;
    this.gamepadButtons = [];
    this._previousGamepadButtons = [];
    this._gamepadWheelDelta = 0;
    this._lastLookConsume = performance.now();
    this.onGamepadActivity = null;
    this.onGamepadChange = null;
    this.onSettingsChange = null;
    this.onBindingsChange = null;

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
      if (this.onLockChange) this.onLockChange(this.pointerLocked);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    });

    this.domElement.addEventListener('mousedown', (e) => this.mouseButtons.add(e.button));
    window.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    this.domElement.addEventListener('wheel', (e) => { this.wheelDelta += Math.sign(e.deltaY); });

    this.domElement.addEventListener('click', () => {
      if (!this.pointerLocked) this.requestLock();
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this._pollGamepad(true);
      this.onGamepadChange?.({ connected: true, id: e.gamepad.id, index: e.gamepad.index });
      console.info(`[Apex] Controller connected: ${e.gamepad.id}`);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.gamepad = null;
        this.gamepadButtons = [];
        this._previousGamepadButtons = [];
      }
      this.onGamepadChange?.({ connected: false, id: e.gamepad.id, index: e.gamepad.index });
    });

    // Must continue while the simulation is paused so gamepad UI / remapping works.
    this._gamepadPollTimer = window.setInterval(() => this._pollGamepad(true), 50);
    this._pollGamepad(false);
  }

  requestLock() {
    try { return this.domElement.requestPointerLock?.(); }
    catch (err) { console.warn('[Apex] Pointer lock request failed.', err); return undefined; }
  }

  update() { this._pollGamepad(false); }

  hasGamepad() {
    this._pollGamepad(false);
    return !!this.gamepad;
  }

  getGamepadName() { return this.gamepad?.id || null; }

  setSetting(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    this.settings[key] = value;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.onSettingsChange?.({ ...this.settings });
  }

  resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
    this.onSettingsChange?.({ ...this.settings });
  }

  setBinding(action, buttonIndex) {
    if (!(action in DEFAULT_BINDINGS)) return;
    const old = this.bindings[action];
    const conflicting = Object.entries(this.bindings).find(([other, index]) => other !== action && index === buttonIndex)?.[0];
    if (conflicting) this.bindings[conflicting] = old;
    this.bindings[action] = buttonIndex;
    try { localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.bindings)); } catch {}
    this.onBindingsChange?.({ ...this.bindings });
  }

  resetBindings() {
    this.bindings = { ...DEFAULT_BINDINGS };
    try { localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.bindings)); } catch {}
    this.onBindingsChange?.({ ...this.bindings });
  }

  getBinding(action) { return this.bindings[action]; }
  getBindings() { return { ...this.bindings }; }
  getButtonLabel(index) { return BUTTON_LABELS[index] || `BUTTON ${index}`; }
  getBindingLabel(action) { return this.getButtonLabel(this.bindings[action]); }
  getActionForButton(index) {
    return Object.entries(this.bindings).find(([, button]) => button === index)?.[0] || null;
  }

  _pollGamepad(emitActivity = false) {
    const pads = navigator.getGamepads?.();
    if (!pads) return;

    let pad = this.gamepadIndex != null ? pads[this.gamepadIndex] : null;
    if (!pad?.connected) {
      pad = Array.from(pads).find((p) => p?.connected) || null;
      this.gamepadIndex = pad?.index ?? null;
    }

    this.gamepad = pad;
    if (!pad) return;

    const nextButtons = pad.buttons.map((b) => !!(b.pressed || b.value > .55));
    for (let i = 0; i < nextButtons.length; i++) {
      const pressed = nextButtons[i] && !this._previousGamepadButtons[i];
      if (!pressed) continue;

      const action = this.getActionForButton(i);
      if (action === 'weaponNext') this._gamepadWheelDelta += 1;
      if (action === 'weaponPrev') this._gamepadWheelDelta -= 1;

      if (emitActivity) this.onGamepadActivity?.({ index: i, action, gamepad: pad });
    }

    this.gamepadButtons = nextButtons;
    this._previousGamepadButtons = nextButtons.slice();
  }

  _axis(index) {
    this._pollGamepad(false);
    return this.gamepad?.axes?.[index] ?? 0;
  }

  _buttonValue(index) {
    this._pollGamepad(false);
    return this.gamepad?.buttons?.[index]?.value ?? 0;
  }

  _actionButtonValue(action) {
    const index = this.bindings[action];
    return index == null ? 0 : this._buttonValue(index);
  }

  _actionDown(action) {
    const index = this.bindings[action];
    return index != null && !!this.gamepadButtons[index];
  }

  _deadzone(value, zone = .12) {
    const a = Math.abs(value);
    if (a <= zone) return 0;
    return Math.sign(value) * Math.min(1, (a - zone) / (1 - zone));
  }

  _curvedAxis(value, zone = .12, exponent = 1.55) {
    const v = this._deadzone(value, zone);
    return Math.sign(v) * Math.pow(Math.abs(v), exponent);
  }

  getMoveAxes() {
    const x = this._deadzone(this._axis(0), .14);
    const y = this._deadzone(this._axis(1), .14);
    return { x, y };
  }

  getVehicleAxes() {
    const move = this.getMoveAxes();
    const keyboardThrottle = this.keys.has('KeyW') ? 1 : 0;
    const keyboardBrake = this.keys.has('KeyS') ? 1 : 0;
    const keyboardSteer = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    return {
      steer: Math.abs(keyboardSteer) > .01 ? keyboardSteer : move.x,
      throttle: Math.max(keyboardThrottle, this._actionButtonValue('fire')),
      brake: Math.max(keyboardBrake, this._actionButtonValue('aim'))
    };
  }

  isDown(code) {
    if (this.keys.has(code)) return true;
    this._pollGamepad(false);
    const lx = this._axis(0), ly = this._axis(1);

    if (code === 'KeyW') return ly < -.38;
    if (code === 'KeyS') return ly > .38;
    if (code === 'KeyA') return lx < -.38;
    if (code === 'KeyD') return lx > .38;

    const action = CODE_TO_ACTION[code];
    return action ? this._actionDown(action) : false;
  }

  isMouseDown(button = 0) {
    if (this.mouseButtons.has(button)) return true;
    this._pollGamepad(false);
    if (!this.gamepad) return false;
    if (button === 0) return this._actionButtonValue('fire') > .18;
    if (button === 2) return this._actionButtonValue('aim') > .18;
    return false;
  }

  consumeMouseDelta() {
    this._pollGamepad(false);
    const now = performance.now();
    const dt = Math.max(.001, Math.min(.05, (now - this._lastLookConsume) / 1000));
    this._lastLookConsume = now;

    const mouseScale = Number(this.settings.mouseSensitivity) || 1;
    const d = {
      x: this.mouseDelta.x * mouseScale,
      y: this.mouseDelta.y * mouseScale
    };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    if (this.gamepad) {
      const zone = Math.max(.02, Math.min(.45, Number(this.settings.rightStickDeadzone) || .19));
      const curve = Math.max(1, Math.min(2.8, Number(this.settings.rightStickCurve) || 1.55));
      const rx = this._curvedAxis(this._axis(2), zone, curve);
      let ry = this._curvedAxis(this._axis(3), zone, curve);
      if (this.settings.invertControllerY) ry *= -1;

      const ads = this.isMouseDown(2) ? (Number(this.settings.adsMultiplier) || .72) : 1;
      const sx = (Number(this.settings.controllerSensitivityX) || 1) * ads;
      const sy = (Number(this.settings.controllerSensitivityY) || 1) * ads;
      d.x += rx * 1500 * sx * dt;
      d.y += ry * 1150 * sy * dt;
    }

    return d;
  }

  consumeWheel() {
    this._pollGamepad(false);
    const w = this.wheelDelta + this._gamepadWheelDelta;
    this.wheelDelta = 0;
    this._gamepadWheelDelta = 0;
    return Math.sign(w);
  }

  pulseGamepad(duration = 70, weak = .18, strong = .08) {
    if (!this.settings.vibration) return;
    this._pollGamepad(false);
    const actuator = this.gamepad?.vibrationActuator;
    if (!actuator?.playEffect) return;
    actuator.playEffect('dual-rumble', {
      duration,
      startDelay: 0,
      weakMagnitude: Math.max(0, Math.min(1, weak)),
      strongMagnitude: Math.max(0, Math.min(1, strong))
    }).catch?.(() => {});
  }
}
