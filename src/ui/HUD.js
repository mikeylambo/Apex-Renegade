import { bus, GameState } from '../core/GameState.js';

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
    this.crosshair = document.getElementById('crosshair');

    this._upgradeShooterHUD();

    bus.on('playerHealth', (pct) => {
      this.healthFill.style.width = `${pct * 100}%`;
      this._syncHealth();
    });
    bus.on('blastCharge', (pct) => {
      this.blastFill.style.width = `${pct * 100}%`;
      this.blastFill.classList.toggle('ready', pct >= 1);
    });
    bus.on('weaponChanged', (w) => this._syncWeapon(w));
    bus.on('weaponFired', (w) => {
      this._syncWeapon(w);
      this._pulseReticle();
    });
    bus.on('reloadStart', ({ name, duration }) => {
      this.weaponName.textContent = `${name} — RELOADING`;
      this.reloadBar.classList.add('show');
      this.reloadFill.style.transition = 'none';
      this.reloadFill.style.width = '0%';
      requestAnimationFrame(() => {
        this.reloadFill.style.transition = `width ${duration}s linear`;
        this.reloadFill.style.width = '100%';
      });
      clearTimeout(this._reloadHudTimer);
      this._reloadHudTimer = setTimeout(() => this.reloadBar.classList.remove('show'), duration * 1000 + 120);
    });

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

  _upgradeShooterHUD() {
    if (!document.getElementById('apex-shooter-hud-style')) {
      const style = document.createElement('style');
      style.id = 'apex-shooter-hud-style';
      style.textContent = `
        #crosshair{--spread:8px;--reticle-scale:1;position:absolute;top:50%;left:50%;width:1px;height:1px;background:transparent!important;box-shadow:none!important;transform:translate(-50%,-50%) scale(var(--reticle-scale));transition:opacity .15s ease}
        .reticle-arm{position:absolute;background:rgba(238,244,250,.94);box-shadow:0 0 5px rgba(198,214,234,.42);transition:transform .07s ease,width .08s ease,height .08s ease}.reticle-arm.h{width:8px;height:1px;top:0}.reticle-arm.v{width:1px;height:8px;left:0}.reticle-arm.left{right:var(--spread);transform:translateY(-50%)}.reticle-arm.right{left:var(--spread);transform:translateY(-50%)}.reticle-arm.top{bottom:var(--spread);transform:translateX(-50%)}.reticle-arm.bottom{top:var(--spread);transform:translateX(-50%)}
        .reticle-dot{position:absolute;width:3px;height:3px;border-radius:50%;background:#eef4fa;transform:translate(-50%,-50%);box-shadow:0 0 6px rgba(163,140,255,.45)}#crosshair.fire .reticle-arm{background:#ffd6a0}#crosshair.ads .reticle-dot{width:2px;height:2px}#crosshair.vehicle{opacity:.28}
        #health-readout{display:flex;align-items:baseline;gap:.35rem;margin:-.1rem 0 .05rem;font-variant-numeric:tabular-nums}#health-current{font-size:1.65rem;font-weight:800;letter-spacing:.04em}#health-max{font-size:.68rem;color:rgba(232,237,244,.48);letter-spacing:.12em}
        #reload-bar{width:225px;height:2px;background:rgba(232,237,244,.08);opacity:0;transition:opacity .15s ease;margin-top:.2rem}#reload-bar.show{opacity:1}#reload-fill{height:100%;width:0;background:#e9a14b}
      `;
      document.head.appendChild(style);
    }

    this.crosshair.innerHTML = '<span class="reticle-arm h left"></span><span class="reticle-arm h right"></span><span class="reticle-arm v top"></span><span class="reticle-arm v bottom"></span><span class="reticle-dot"></span>';

    const hp = document.createElement('div');
    hp.id = 'health-readout';
    hp.innerHTML = '<span id="health-current">100</span><span id="health-max">/ 100 HP</span>';
    const healthTrack = this.healthFill.parentElement;
    healthTrack.parentElement.insertBefore(hp, healthTrack);
    this.healthCurrent = hp.querySelector('#health-current');
    this.healthMax = hp.querySelector('#health-max');

    this.reloadBar = document.createElement('div');
    this.reloadBar.id = 'reload-bar';
    this.reloadBar.innerHTML = '<div id="reload-fill"></div>';
    this.reloadFill = this.reloadBar.firstElementChild;
    this.ammoReadout.parentElement.appendChild(this.reloadBar);
    this._syncHealth();
  }

  update(dt, player, input) {
    if (!this.crosshair || !player || !input) return;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const ads = input.isMouseDown(2) && !player.vehicleMounted;
    const spread = (ads ? 4.0 : 7.2) + Math.min(8, speed * .42) + (player.sliding ? 3.2 : 0) + (!player.grounded ? 1.4 : 0);
    this.crosshair.style.setProperty('--spread', `${spread.toFixed(2)}px`);
    this.crosshair.style.setProperty('--reticle-scale', String(input.settings.reticleScale || 1));
    this.crosshair.classList.toggle('ads', ads);
    this.crosshair.classList.toggle('vehicle', !!player.vehicleMounted);
    this._syncHealth();
  }

  _syncHealth() {
    if (!this.healthCurrent) return;
    this.healthCurrent.textContent = Math.max(0, Math.ceil(GameState.health));
    this.healthMax.textContent = `/ ${Math.ceil(GameState.maxHealth)} HP`;
  }

  _pulseReticle() {
    this.crosshair?.classList.add('fire');
    clearTimeout(this._reticleTimer);
    this._reticleTimer = setTimeout(() => this.crosshair?.classList.remove('fire'), 75);
  }

  _syncWeapon(w) {
    this.weaponName.textContent = w.name;
    this.ammoReadout.textContent = `${w.ammo} / ${w.reserve}`;
    this.reloadBar?.classList.remove('show');
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
