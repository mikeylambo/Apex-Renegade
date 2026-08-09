import { bus, GameState } from '../core/GameState.js';
import { meleeArcAttack } from './weapons/meleeUtils.js';

const WINDOW_DURATION = 4.5;
const HEAL_ON_SUCCESS = 0.65;
const CHARGE_ON_SUCCESS = 40;
const SWING_RANGE = 4.5;
const SWING_ARC = 1.3;
const SWING_DAMAGE = 70;
const SWING_COOLDOWN = 0.4;

export class FeralReversal {
  constructor(weaponSystem) {
    this.ws = weaponSystem;
    this.active = false;
    this.timer = 0;
    this._swingCd = 0;
    this._killDuringWindow = false;
    this.charges = Infinity;
    bus.on('enemyDied', () => { if (this.active) this._killDuringWindow = true; });
    bus.on('bossDefeated', () => { if (this.active) this._killDuringWindow = true; });
    GameState.deathInterceptor = () => this.tryIntercept();
  }

  tryIntercept() {
    if (this.active || GameState.inBlastMode || this.charges <= 0) return false;
    this.active = true;
    this.timer = WINDOW_DURATION;
    this._killDuringWindow = false;
    this._swingCd = 0;
    GameState.inFeralReversal = true;
    GameState.health = 1;
    bus.emit('playerHealth', GameState.health / GameState.maxHealth);
    bus.emit('feralReversalStart', WINDOW_DURATION);
    bus.emit('weaponChanged', { name: 'the Coil', ammo: '∞', reserve: '—' });
    return true;
  }

  update(dt) {
    if (!this.active) return;
    if (this._swingCd > 0) this._swingCd -= dt;
    if (this.ws.input.isMouseDown(0) && this._swingCd <= 0) {
      this._swingCd = SWING_COOLDOWN;
      const hit = meleeArcAttack(this.ws, { range: SWING_RANGE, arc: SWING_ARC, damage: SWING_DAMAGE });
      bus.emit('meleeSwing', { hit });
    }
    this.timer -= dt;
    if (this._killDuringWindow) this._resolve(true);
    else if (this.timer <= 0) this._resolve(false);
  }

  _resolve(success) {
    this.active = false;
    GameState.inFeralReversal = false;
    if (success) {
      if (this.charges !== Infinity) this.charges -= 1;
      GameState.health = Math.round(GameState.maxHealth * HEAL_ON_SUCCESS);
      bus.emit('playerHealth', GameState.health / GameState.maxHealth);
      GameState.addBlastCharge(CHARGE_ON_SUCCESS);
      bus.emit('feralReversalSuccess');
      bus.emit('weaponChanged', { name: this.ws.active.name, ammo: this.ws.active.ammo, reserve: this.ws.active.reserve });
    } else {
      GameState.health = 0;
      bus.emit('playerHealth', 0);
      bus.emit('feralReversalFail');
      bus.emit('playerDied');
    }
  }
}
