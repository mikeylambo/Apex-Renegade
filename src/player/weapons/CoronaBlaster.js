import { bus, GameState } from '../../core/GameState.js';

/**
 * The Renegade's signature dual pistols. Design intent: this is the weapon
 * you hold 70% of the game, so it needs zero downtime feel — high fire
 * rate, tiny recoil, alternating muzzles for visual rhythm.
 */
export class CoronaBlaster {
  constructor(weaponSystem) {
    this.ws = weaponSystem;
    this.name = 'Corona Blaster';
    this.fireRate = 8.5; // shots/sec
    this.damage = 14;
    this.spread = 0.012;
    this.magSize = 24;
    this.ammo = this.magSize;
    this.reserve = 168;
    this.reloadTime = 1.4;

    this._cooldown = 0;
    this._reloading = false;
    this._reloadTimer = 0;
    this._alternate = 0;
  }

  update(dt) {
    if (this._cooldown > 0) this._cooldown -= dt;
    if (this._reloading) {
      this._reloadTimer -= dt;
      if (this._reloadTimer <= 0) this._finishReload();
    }
    if (this.ws.input.isDown('KeyR') && !this._reloading && this.ammo < this.magSize && this.reserve > 0) {
      this._startReload();
    }
  }

  tryFire() {
    if (this._reloading || this._cooldown > 0) return;
    if (this.ammo <= 0) {
      if (this.reserve > 0) this._startReload();
      return;
    }
    const tier = GameState.refusalTier;
    const fireRate = this.fireRate * (1 + tier * .10);
    const damageMult = [1, 1.22, 1.58, 2.08, 2.85][tier] ?? 2.85;
    const pierce = [1, 2, 4, 8, 14][tier] ?? 14;
    this._cooldown = 1 / fireRate;
    this.ammo -= 1;
    this._alternate = 1 - this._alternate;

    this.ws.hitscan({ spread: this.spread * Math.max(.38, 1 - tier * .13), damage: this.damage * damageMult, pierceCount: pierce });
    bus.emit('weaponFired', { name: this.name, side: this._alternate, ammo: this.ammo, reserve: this.reserve });
    this.ws.camera.parent && bus.emit('recoil', { pitch: 0.006, yaw: 0.004 });
  }

  _startReload() {
    this._reloading = true;
    this._reloadTimer = this.reloadTime;
    bus.emit('reloadStart', { name: this.name, duration: this.reloadTime });
  }

  _finishReload() {
    const needed = this.magSize - this.ammo;
    const take = Math.min(needed, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this._reloading = false;
    bus.emit('weaponChanged', { name: this.name, ammo: this.ammo, reserve: this.reserve });
  }
}
