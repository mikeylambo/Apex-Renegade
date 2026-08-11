import { bus } from '../core/GameState.js';

export class BikeHUDPrompts {
  constructor(input, bike, hud) {
    this.input = input;
    this.bike = bike;
    this.hud = hud;
    this.lastDistance = Infinity;
    this._controlTimer = 0;
    this._build();

    bus.on('bikeProximity', ({ distance, mounted, recalling }) => {
      this.lastDistance = distance;
      this._syncPrompt(distance, mounted, recalling);
    });
    bus.on('bikeMounted', () => {
      this._controlTimer = 5.5;
      this.controls.classList.add('show');
      this.prompt.classList.remove('show');
    });
    bus.on('bikeDismounted', () => this.controls.classList.remove('show'));
    bus.on('bikeRecall', () => this._flash('BIKE RECALLED'));
    bus.on('bikeRecallArrived', () => this._flash('RENEGADE BIKE // READY'));
    bus.on('bikeRecovered', () => this._flash('WORLD RECOVERY // BIKE RESTORED'));
    bus.on('bikeLanded', ({ airTime, clean }) => {
      if (airTime < 1.35) return;
      if (clean) this._flash('CLEAN LANDING');
    });
    bus.on('weaponFired', ({ ammo, reserve }) => {
      if (!this.bike.mounted) return;
      if (this.hud?.weaponName) this.hud.weaponName.textContent = 'RENEGADE BIKE // CORONA';
      if (this.hud?.ammoReadout) this.hud.ammoReadout.textContent = `${ammo} / ${reserve}`;
    });
  }

  _build() {
    if (!document.getElementById('bike-hud-style')) {
      const style = document.createElement('style');
      style.id = 'bike-hud-style';
      style.textContent = `
        #bike-prompt{position:fixed;left:50%;bottom:13%;transform:translate(-50%,12px);z-index:26;pointer-events:none;opacity:0;padding:.72rem 1rem;border:1px solid rgba(163,140,255,.42);background:rgba(5,8,13,.72);backdrop-filter:blur(7px);font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#edf2f8;transition:opacity .16s ease,transform .16s ease}#bike-prompt.show{opacity:1;transform:translate(-50%,0)}#bike-prompt b{color:#a38cff}
        #bike-controls{position:fixed;left:50%;bottom:7.6%;transform:translateX(-50%);z-index:25;pointer-events:none;opacity:0;text-align:center;color:rgba(237,242,248,.74);font-size:.61rem;letter-spacing:.13em;text-transform:uppercase;transition:opacity .2s ease}#bike-controls.show{opacity:1}
        #bike-drive{position:fixed;left:50%;bottom:3.4%;transform:translateX(-50%);z-index:25;pointer-events:none;display:none;width:min(330px,42vw)}#bike-drive.show{display:block}.bike-drive-head{display:flex;justify-content:space-between;font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(237,242,248,.62);margin-bottom:.28rem}.bike-drive-track{height:4px;background:rgba(237,242,248,.09);overflow:hidden}.bike-drive-fill{height:100%;width:100%;background:linear-gradient(90deg,#6f66ee,#a38cff);box-shadow:0 0 8px rgba(118,103,245,.42);transition:width .08s linear}
        #bike-flash{position:fixed;left:50%;top:34%;transform:translateX(-50%);z-index:25;pointer-events:none;opacity:0;color:#edf2f8;font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;transition:opacity .14s ease}#bike-flash.show{opacity:1}
      `;
      document.head.appendChild(style);
    }

    this.prompt = document.createElement('div'); this.prompt.id = 'bike-prompt'; document.body.appendChild(this.prompt);
    this.controls = document.createElement('div'); this.controls.id = 'bike-controls'; this.controls.textContent = 'RT THROTTLE · LT BRAKE · A BOOST · LB DRIFT · RB CORONA · X RELOAD · PULL LS BACK WHEELIE · D-PAD ↓ DISMOUNT'; document.body.appendChild(this.controls);
    this.drive = document.createElement('div'); this.drive.id = 'bike-drive'; this.drive.innerHTML = '<div class="bike-drive-head"><span>Spectral Drive</span><span id="bike-drive-value">100</span></div><div class="bike-drive-track"><div class="bike-drive-fill"></div></div>'; document.body.appendChild(this.drive);
    this.driveFill = this.drive.querySelector('.bike-drive-fill'); this.driveValue = this.drive.querySelector('#bike-drive-value');
    this.flash = document.createElement('div'); this.flash.id = 'bike-flash'; document.body.appendChild(this.flash);
  }

  _syncPrompt(distance, mounted, recalling) {
    if (mounted) {
      this.prompt.classList.remove('show');
      this.drive.classList.add('show');
      return;
    }
    this.drive.classList.remove('show');
    if (recalling) {
      this.prompt.innerHTML = '<b>RECALLING</b> // SPECTRAL SIGNATURE INBOUND';
      this.prompt.classList.add('show');
      return;
    }
    if (distance <= 7.2) {
      const pad = this.input.getBindingLabel?.('bike') || 'D-PAD DOWN';
      this.prompt.innerHTML = `<b>V / ${pad}</b> // MOUNT RENEGADE BIKE`;
      this.prompt.classList.add('show');
    } else this.prompt.classList.remove('show');
  }

  _flash(text) {
    this.flash.textContent = text;
    this.flash.classList.add('show');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.flash.classList.remove('show'), 850);
  }

  update(dt) {
    if (this._controlTimer > 0) {
      this._controlTimer -= dt;
      if (this._controlTimer <= 0) this.controls.classList.remove('show');
    }
    if (!this.bike.mounted) return;
    const energy = Math.max(0, Math.min(100, this.bike.boostEnergy));
    this.driveFill.style.width = `${energy}%`;
    this.driveValue.textContent = Math.round(energy);
    this.drive.classList.add('show');
  }
}
