import * as THREE from 'three/webgpu';
import { bus, GameState } from '../../core/GameState.js';
import { meleeArcAttack } from './meleeUtils.js';

export class BlastMode {
  constructor(weaponSystem) {
    this.ws = weaponSystem;
    this.name = 'the Coil';
    this.duration = 10;
    this.timer = 0;
    this.meleeRange = 4.5;
    this.meleeArc = 1.3;
    this.meleeDamage = 55;
    this.meleeCooldown = 0.55;
    this._meleeCd = 0;
    this.lungeSpeed = 26;
    this.lungeCooldown = 1.2;
    this._lungeCd = 0;
    this.speedMultiplier = 1.45;
    this._appliedSpeedBuff = false;
  }

  enter() { this.timer = this.duration; bus.emit('blastVisual', true); }
  exit() { bus.emit('blastVisual', false); }

  update(dt) {
    this.timer -= dt;
    if (this._meleeCd > 0) this._meleeCd -= dt;
    if (this._lungeCd > 0) this._lungeCd -= dt;
    if (this.ws.input.isMouseDown(0) && this._meleeCd <= 0) this._meleeAttack();
    if (this.ws.input.isMouseDown(2) && this._lungeCd <= 0) this._lunge();
    if (this.timer <= 0) this.ws.exitBlastMode();
  }

  _meleeAttack() {
    this._meleeCd = this.meleeCooldown;
    const hitAny = meleeArcAttack(this.ws, { range: this.meleeRange, arc: this.meleeArc, damage: this.meleeDamage });
    if (hitAny) GameState.addBlastCharge(4);
    bus.emit('meleeSwing', { hit: hitAny });
  }

  _lunge() {
    this._lungeCd = this.lungeCooldown;
    const dir = new THREE.Vector3();
    this.ws.camera.getWorldDirection(dir);
    dir.y = Math.max(dir.y, 0.05);
    this.ws.player.velocity.copy(dir).multiplyScalar(this.lungeSpeed);
    bus.emit('lunge');
  }
}
