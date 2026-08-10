/**
 * Centralized keyboard / mouse / USB controller input.
 *
 * Standard Gamepad mapping (Xbox labels / PlayStation equivalents):
 *   LS move/steer, RS look, RT fire / bike throttle, LT aim / bike brake,
 *   A/Cross jump / bike boost, B/Circle crouch-slide, X/Square reload,
 *   Y/Triangle weapon cycle, LB dash / bike drift, RB Apex Surge,
 *   L3 sprint, D-pad Up flight toggle, D-pad Down mount/dismount,
 *   D-pad Left/Right weapon cycle.
 */
export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this.keys = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.mouseButtons = new Set();
    this.pointerLocked = false;
    this.wheelDelta = 0;

    this.gamepadIndex = null;
    this.gamepad = null;
    this.gamepadButtons = [];
    this._previousGamepadButtons = [];
    this._gamepadWheelDelta = 0;
    this._lastLookConsume = performance.now();
    this.onGamepadActivity = null;
    this.onGamepadChange = null;

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

    // Gamepad input must work before engine.start(), so the start screen gets a
    // lightweight independent poll. The main loop also refreshes it per frame.
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

      // Y/Triangle and D-pad left/right cycle weapons on button-down edges.
      if (i === 3 || i === 15) this._gamepadWheelDelta += 1;
      if (i === 14) this._gamepadWheelDelta -= 1;

      if (emitActivity) this.onGamepadActivity?.({ index: i, gamepad: pad });
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
      throttle: Math.max(keyboardThrottle, this._buttonValue(7)),
      brake: Math.max(keyboardBrake, this._buttonValue(6))
    };
  }

  isDown(code) {
    if (this.keys.has(code)) return true;
    this._pollGamepad(false);
    const b = (i) => !!this.gamepadButtons[i];
    const lx = this._axis(0), ly = this._axis(1);

    switch (code) {
      case 'KeyW': return ly < -.38;
      case 'KeyS': return ly > .38;
      case 'KeyA': return lx < -.38;
      case 'KeyD': return lx > .38;
      case 'Space': return b(0);                   // A / Cross
      case 'ControlLeft':
      case 'KeyC': return b(1);                  // B / Circle
      case 'KeyR': return b(2);                  // X / Square
      case 'KeyQ': return b(4);                  // LB / L1
      case 'KeyF': return b(5);                  // RB / R1
      case 'ShiftLeft': return b(10);             // L3
      case 'KeyE': return b(12);                  // D-pad Up
      case 'KeyV': return b(13);                  // D-pad Down
      default: return false;
    }
  }

  isMouseDown(button = 0) {
    if (this.mouseButtons.has(button)) return true;
    this._pollGamepad(false);
    if (!this.gamepad) return false;
    if (button === 0) return this._buttonValue(7) > .18; // RT / R2
    if (button === 2) return this._buttonValue(6) > .18; // LT / L2
    return false;
  }

  consumeMouseDelta() {
    this._pollGamepad(false);
    const now = performance.now();
    const dt = Math.max(.001, Math.min(.05, (now - this._lastLookConsume) / 1000));
    this._lastLookConsume = now;

    const d = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    if (this.gamepad) {
      const rx = this._curvedAxis(this._axis(2), .11, 1.48);
      const ry = this._curvedAxis(this._axis(3), .11, 1.48);
      d.x += rx * 1500 * dt;
      d.y += ry * 1150 * dt;
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
