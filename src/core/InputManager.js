/**
 * Centralized input state. Movement code reads booleans off this each
 * fixed-update tick rather than wiring individual key listeners everywhere.
 */
export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this.keys = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.mouseButtons = new Set();
    this.pointerLocked = false;
    this.wheelDelta = 0;

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
      if (!this.pointerLocked) this.domElement.requestPointerLock();
    });
  }

  requestLock() { this.domElement.requestPointerLock(); }
  isDown(code) { return this.keys.has(code); }
  isMouseDown(button = 0) { return this.mouseButtons.has(button); }

  consumeMouseDelta() {
    const d = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return d;
  }

  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }
}
