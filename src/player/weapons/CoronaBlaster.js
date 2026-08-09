import { bus } from '../../core/GameState.js';

export class CoronaBlaster {
  constructor(weaponSystem) {
    this.ws = weaponSystem;
    this.name = 'Corona Blaster';
    this.fireRate = 8.5;
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
    if (this.ws.input.isDown('KeyR') && !this._reloading && this.ammo < this.magSize && this.reserve > 0) this._startReload();
  }

  tryFire() {
    if (this._reloading || this._cooldown > 0) return;
    if (this.ammo <= 0) { if (this.reserve > 0) this._startReload(); return; }
    this._cooldown = 1 / this.fireRate;
    this.ammo -= 1;
    this._alternate = 1 - this._alternate;
    this.ws.hitscan({ spread: this.spread, damage: this.damage, pierceCount: 1 });
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
