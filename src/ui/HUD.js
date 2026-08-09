import { bus } from '../core/GameState.js';

export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.healthFill = document.getElementById('health-fill');
    this.blastFill = document.getElementById('blast-fill');
    this.ammoReadout = document.getElementById('ammo-readout');
    this.weaponName = document.getElementById('weapon-name');
    this.waveNumber = document.getElementById('wave-number');
    this.blastBanner = document.getElementById('blast-banner');
    this.vignette = document.getElementById('damage-vignette');
    this.centerMsg = document.getElementById('center-msg');
    this.appEl = document.getElementById('app');
    this.feralOverlay = document.getElementById('feral-overlay');
    this.feralBanner = document.getElementById('feral-banner');
    this.feralBarFill = document.getElementById('feral-bar-fill');
    this.ferocityFill = document.getElementById('ferocity-fill');

    bus.on('playerHealth', (pct) => { this.healthFill.style.width = `${pct * 100}%`; });
    bus.on('blastCharge', (pct) => {
      this.blastFill.style.width = `${pct * 100}%`;
      this.blastFill.classList.toggle('ready', pct >= 1);
    });
    bus.on('weaponChanged', (w) => this._syncWeapon(w));
    bus.on('weaponFired', (w) => this._syncWeapon(w));
    bus.on('reloadStart', ({ name }) => { this.weaponName.textContent = `${name} — reloading`; });
    bus.on('ferocity', (pct) => { this.ferocityFill.style.width = `${pct * 100}%`; });
    bus.on('ferocityTier', (tier) => {
      this.ferocityFill.classList.toggle('tier1', tier >= 1);
      this.ferocityFill.classList.toggle('tier2', tier >= 2);
      if (tier === 2) this._flashCenter('Ferocious', 900);
    });
    bus.on('waveStart', (n) => { this.waveNumber.textContent = n; });
    bus.on('bossSpawn', (name) => this._flashCenter(`${name} awakens`, 2200));
    bus.on('bossDefeated', (name) => this._flashCenter(`${name} destroyed`, 2200));
    bus.on('blastModeStart', () => this._showBanner(true));
    bus.on('blastModeEnd', () => this._showBanner(false));
    bus.on('feralReversalStart', (duration) => this._startFeral(duration));
    bus.on('feralReversalSuccess', () => this._endFeral());
    bus.on('feralReversalFail', () => this._endFeral());
    bus.on('ruptureSealed', () => this._flashCenter('Tear sealed', 1400));
    bus.on('enemyAttack', () => this._pulseDamage());
    bus.on('areaLoaded', ({ name }) => this._flashCenter(name, 2500));
  }

  _syncWeapon(w) {
    this.weaponName.textContent = w.name;
    this.ammoReadout.textContent = `${w.ammo} / ${w.reserve}`;
  }

  _showBanner(show) { this.blastBanner.classList.toggle('show', show); }

  _startFeral(duration) {
    this.appEl.classList.add('feral-active');
    this.feralOverlay.classList.add('active');
    this.feralBanner.classList.add('show');
    this.feralBarFill.style.animation = 'none';
    void this.feralBarFill.offsetWidth;
    this.feralBarFill.style.animation = `feralDrain ${duration}s linear forwards`;
  }

  _endFeral() {
    this.appEl.classList.remove('feral-active');
    this.feralOverlay.classList.remove('active');
    this.feralBanner.classList.remove('show');
  }

  _flashCenter(text, ms) {
    this.centerMsg.textContent = text;
    this.centerMsg.classList.add('show');
    clearTimeout(this._centerTimer);
    this._centerTimer = setTimeout(() => this.centerMsg.classList.remove('show'), ms);
  }

  _pulseDamage() {
    this.vignette.style.boxShadow = 'inset 0 0 180px 40px rgba(212,20,90,0.55)';
    clearTimeout(this._vignetteTimer);
    this._vignetteTimer = setTimeout(() => { this.vignette.style.boxShadow = 'inset 0 0 0 0 rgba(212,20,90,0)'; }, 220);
  }

  show() { this.el.style.display = 'block'; }
  hide() { this.el.style.display = 'none'; }
}
