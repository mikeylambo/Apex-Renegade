import { bus } from '../core/GameState.js';

const TIER_NAMES = ['BASELINE', 'ENGAGED', 'ASCENDANT', 'AIRBORNE', 'CATASTROPHIC'];

export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.healthFill = document.getElementById('health-fill');
    this.blastFill = document.getElementById('blast-fill');
    this.refusalFill = document.getElementById('refusal-fill');
    this.refusalTier = document.getElementById('refusal-tier');
    this.pressureFill = document.getElementById('pressure-fill');
    this.pressureStage = document.getElementById('pressure-stage');
    this.contacts = document.getElementById('contacts-readout');
    this.ammoReadout = document.getElementById('ammo-readout');
    this.weaponName = document.getElementById('weapon-name');
    this.blastBanner = document.getElementById('blast-banner');
    this.vignette = document.getElementById('damage-vignette');
    this.centerMsg = document.getElementById('center-msg');
    this.appEl = document.getElementById('app');
    this.feralOverlay = document.getElementById('feral-overlay');
    this.feralBanner = document.getElementById('feral-banner');
    this.feralBarFill = document.getElementById('feral-bar-fill');

    bus.on('playerHealth', (pct) => { this.healthFill.style.width = `${pct * 100}%`; });
    bus.on('blastCharge', (pct) => {
      this.blastFill.style.width = `${pct * 100}%`;
      this.blastFill.classList.toggle('ready', pct >= 1);
    });
    bus.on('weaponChanged', (w) => this._syncWeapon(w));
    bus.on('weaponFired', (w) => this._syncWeapon(w));
    bus.on('reloadStart', ({ name }) => { this.weaponName.textContent = `${name} — RELOADING`; });

    bus.on('refusal', ({ pct, tier }) => {
      this.refusalFill.style.width = `${pct * 100}%`;
      this.refusalTier.textContent = `T${tier} // ${TIER_NAMES[tier] || 'UNKNOWN'}`;
    });
    bus.on('refusalTier', (tier) => {
      this.refusalTier.textContent = `T${tier} // ${TIER_NAMES[tier] || 'UNKNOWN'}`;
      this.refusalFill.classList.toggle('breakthrough', tier >= 2);
      if (tier === 3) this._flashCenter('REFUSAL III // FLIGHT ONLINE — E / D-PAD UP', 3600);
      else this._flashCenter(`REFUSAL ${tier} // ${TIER_NAMES[tier]}`, 2200);
    });
    bus.on('refusalBreakthrough', ({ tier }) => { if (tier > 0) this._pulseRefusal(); });

    bus.on('pressure', ({ pct, stageName }) => {
      this.pressureFill.style.width = `${pct * 100}%`;
      this.pressureStage.textContent = stageName;
      this.pressureFill.classList.toggle('total', pct >= .8);
    });
    bus.on('contacts', (count) => { this.contacts.textContent = `${count.toLocaleString()} CONTACTS`; });
    bus.on('mobilization', ({ name }) => this._flashCenter(name, 1800));
    bus.on('reinforcementsInbound', ({ count }) => { if (count >= 3) this._flashCenter(`REINFORCEMENTS // +${count}`, 950); });

    bus.on('regionChanged', ({ name }) => this._flashCenter(name, 2300));
    bus.on('bikeMounted', () => {
      this.weaponName.textContent = 'RENEGADE BIKE';
      this.ammoReadout.textContent = 'RT THROTTLE';
      this._flashCenter('RIDE // RT THROTTLE · LT BRAKE · A BOOST · LB DRIFT · D-PAD DOWN DISMOUNT', 3000);
    });
    bus.on('bikeDismounted', () => this._flashCenter('ON FOOT', 950));
    bus.on('bikeBoost', () => {
      this.ammoReadout.textContent = 'BOOST';
      clearTimeout(this._bikeTimer);
      this._bikeTimer = setTimeout(() => { this.ammoReadout.textContent = ''; }, 320);
    });

    bus.on('blastModeStart', () => this._showBanner(true));
    bus.on('blastModeEnd', () => this._showBanner(false));
    bus.on('feralReversalStart', (duration) => this._startFeral(duration));
    bus.on('feralReversalSuccess', () => this._endFeral());
    bus.on('feralReversalFail', () => this._endFeral());
    bus.on('enemyAttack', () => this._pulseDamage());
    bus.on('areaLoaded', ({ name }) => this._flashCenter(name, 2800));
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

  _pulseRefusal() {
    this.refusalFill.style.filter = 'brightness(2.2)';
    clearTimeout(this._refusalTimer);
    this._refusalTimer = setTimeout(() => { this.refusalFill.style.filter = ''; }, 420);
  }

  show() { this.el.style.display = 'block'; }
  hide() { this.el.style.display = 'none'; }
}
