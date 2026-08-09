import { bus } from '../../core/GameState.js';

export class Maw {
  constructor(weaponSystem) {
    this.ws = weaponSystem;
    this.name = 'Maw';
    this.fireRate = 1.1;
    this.pellets = 9;
    this.pelletDamage = 9;
    this.spread = 0.09;
    this.magSize = 6;
    this.ammo = this.magSize;
    this.reserve = 42;
    this.reloadTime = 2.1;
    this._cooldown = 0;
    this._reloading = false;
    this._reloadTimer = 0;
  }

  update(dt) {
    if (this._cooldown > 0) this._cooldown -= dt;
    if (this._reloading) {
      this._reloadTimer -= dt;
      if (this._reloadTimer <= 0) this._finishReload();
    }
    if (this.ws.input.isDown('KeyR') && !this._reloading && this.ammo < this.magSize && this.reserve > 0) this._startReload();
  }

  tryFire() {
    if (this._reloading || this._cooldown > 0) return;
    if (this.ammo <= 0) { if (this.reserve > 0) this._startReload(); return; }
    this._cooldown = 1 / this.fireRate;
    this.ammo -= 1;
    const hitTargets = new Set();
    for (let i = 0; i < this.pellets; i++) {
      const results = this.ws.hitscan({ spread: this.spread, damage: this.pelletDamage, pierceCount: 1 });
      results.forEach((r) => hitTargets.add(r.target));
    }
    bus.emit('weaponFired', { name: this.name, side: 0, ammo: this.ammo, reserve: this.reserve, big: true });
    bus.emit('recoil', { pitch: 0.045, yaw: 0.01 });
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
