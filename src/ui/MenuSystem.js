import { bus } from '../core/GameState.js';

const ACTION_LABELS = {
  fire: 'Fire / Bike Throttle', aim: 'Aim / Bike Brake', jump: 'Jump / Boost',
  crouch: 'Crouch / Slide', reload: 'Reload', weaponNext: 'Next Weapon', weaponPrev: 'Previous Weapon',
  dash: 'Dash / Bike Drift', surge: 'Apex Surge', sprint: 'Sprint', flight: 'Flight Toggle',
  bike: 'Mount / Dismount', pause: 'Pause'
};

export class MenuSystem {
  constructor(input, engine, hud, onStart) {
    this.input = input;
    this.engine = engine;
    this.hud = hud;
    this.onStart = onStart;
    this.bootScreen = document.getElementById('boot-screen');
    this.bootPrompt = document.getElementById('boot-prompt');
    this.started = false;
    this.starting = false;
    this.paused = false;
    this.settingsOpen = false;
    this.captureAction = null;

    this._injectMenuStyle();
    this._buildPauseUI();

    const start = (event) => {
      event?.preventDefault?.();
      this._start(false);
    };
    this.bootScreen.addEventListener('pointerdown', start, { passive: false });
    this.bootScreen.addEventListener('keydown', (event) => {
      if (event.code === 'Enter' || event.code === 'Space') start(event);
    });
    this.bootScreen.tabIndex = 0;
    this.bootScreen.setAttribute('role', 'button');
    this.bootScreen.setAttribute('aria-label', 'Start Apex Renegade');

    window.addEventListener('keydown', (event) => {
      if (!this.started) return;
      if (this.captureAction) {
        if (event.code === 'Escape') this._cancelCapture();
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        if (this.settingsOpen) this._showPauseRoot();
        else this._togglePause();
      }
    });

    this.input.onGamepadActivity = ({ index, action }) => {
      if (!this.started) { this._start(true); return; }
      if (this.captureAction) { this._finishCapture(index); return; }
      if (action === 'pause') { this._togglePause(); return; }
      if (this.paused) this._handleMenuGamepad(index);
    };

    this.input.onGamepadChange = ({ connected }) => {
      if (!this.started && connected) this._setPrompt('Controller detected // press any button');
    };

    this.input.onBindingsChange = () => this._refreshBindingLabels();
    this.input.onSettingsChange = () => this._syncSettingsUI();

    this.input.onLockChange = (locked) => {
      if (!locked && this.started && !this.paused && !this.input.hasGamepad()) this._showPause();
    };

    bus.on('playerDied', () => this._showGameOver());
    this._setPrompt(this.input.hasGamepad()
      ? 'Controller detected // press any button'
      : 'Ready // click to enter the war');
  }

  _injectMenuStyle() {
    if (document.getElementById('apex-menu-style')) return;
    const style = document.createElement('style');
    style.id = 'apex-menu-style';
    style.textContent = `
      #pause-overlay{position:fixed;inset:0;z-index:45;display:none;background:linear-gradient(90deg,rgba(2,5,9,.94) 0%,rgba(4,8,14,.90) 42%,rgba(4,8,14,.38) 68%,rgba(4,8,14,.08) 100%);color:#e8edf4;font-family:inherit;pointer-events:auto}
      .pause-shell{width:min(760px,92vw);height:100%;padding:8vh 5vw;overflow:auto}.pause-kicker{letter-spacing:.32em;text-transform:uppercase;color:#92a4b8;font-size:.72rem}.pause-title{margin:.35rem 0 2.2rem;font-size:clamp(2.8rem,7vw,5.6rem);letter-spacing:.08em;text-transform:uppercase}.pause-actions{display:flex;flex-direction:column;gap:.55rem;width:min(420px,100%)}
      .apex-btn,.bind-btn{appearance:none;border:1px solid rgba(232,237,244,.18);background:rgba(13,20,30,.72);color:#e8edf4;padding:.9rem 1rem;text-align:left;font:inherit;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}.apex-btn:hover,.apex-btn:focus,.bind-btn:hover,.bind-btn:focus{border-color:#a38cff;background:rgba(118,103,245,.12);outline:none}.apex-btn.primary{border-color:rgba(163,140,255,.58)}
      .settings-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.3rem}.settings-title{font-size:2rem;letter-spacing:.08em;text-transform:uppercase}.settings-section{margin:1.7rem 0 2.2rem}.settings-section h3{font-size:.75rem;letter-spacing:.25em;text-transform:uppercase;color:#92a4b8;margin:0 0 .8rem}.setting-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(190px,1.2fr) 64px;gap:1rem;align-items:center;padding:.55rem 0;border-bottom:1px solid rgba(232,237,244,.07)}.setting-row label{font-size:.86rem;letter-spacing:.08em;text-transform:uppercase}.setting-row input[type=range]{width:100%;accent-color:#8e7cff}.setting-row input[type=checkbox]{width:20px;height:20px;accent-color:#8e7cff}.setting-value{text-align:right;color:#a38cff;font-variant-numeric:tabular-nums}
      .bind-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem .8rem}.bind-row{display:grid;grid-template-columns:1fr 180px;align-items:center;gap:.8rem;border-bottom:1px solid rgba(232,237,244,.07);padding:.45rem 0}.bind-row span{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}.bind-btn{padding:.65rem .75rem;font-size:.72rem;text-align:center}.capture-note{display:none;margin:1rem 0;padding:1rem;border:1px solid rgba(163,140,255,.6);background:rgba(118,103,245,.1);letter-spacing:.12em;text-transform:uppercase;color:#c8bcff}.capture-note.show{display:block}
      .menu-foot{margin-top:2rem;color:rgba(232,237,244,.5);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}.settings-back{width:auto}.focus-ring{box-shadow:0 0 0 2px rgba(163,140,255,.55)}
      @media(max-width:680px){.pause-shell{padding:5vh 6vw}.bind-grid{grid-template-columns:1fr}.setting-row{grid-template-columns:1fr 1fr}.setting-row input[type=range]{grid-column:1/-1}.setting-value{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  _buildPauseUI() {
    const el = document.createElement('div');
    el.id = 'pause-overlay';
    el.innerHTML = `
      <div class="pause-shell">
        <div id="pause-root">
          <div class="pause-kicker">Apex Renegade // World Spine</div>
          <div class="pause-title">Paused</div>
          <div class="pause-actions">
            <button class="apex-btn primary" data-action="resume">Resume</button>
            <button class="apex-btn" data-action="settings">Settings</button>
            <button class="apex-btn" data-action="restart">Restart Run</button>
          </div>
          <div class="menu-foot">Esc / Menu: resume · D-pad: navigate · A/Cross: select · B/Circle: back</div>
        </div>
        <div id="settings-root" style="display:none">
          <div class="settings-head"><div><div class="pause-kicker">Shooter Foundation v0.2</div><div class="settings-title">Settings</div></div><button class="apex-btn settings-back" data-action="back">Back</button></div>
          <div class="settings-section"><h3>Aim & Camera</h3><div id="settings-controls"></div></div>
          <div class="settings-section"><h3>Controller Remapping</h3><div id="capture-note" class="capture-note">Press a controller button… Escape cancels</div><div id="binding-grid" class="bind-grid"></div></div>
          <div class="pause-actions"><button class="apex-btn" data-action="reset-settings">Reset Aim Settings</button><button class="apex-btn" data-action="reset-bindings">Reset Controller Layout</button></div>
          <div class="menu-foot">Changes save automatically on this device.</div>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._pauseEl = el;
    this._pauseRoot = el.querySelector('#pause-root');
    this._settingsRoot = el.querySelector('#settings-root');
    this._captureNote = el.querySelector('#capture-note');

    el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'resume') this._hidePause();
      if (action === 'settings') this._showSettings();
      if (action === 'restart') window.location.reload();
      if (action === 'back') this._showPauseRoot();
      if (action === 'reset-settings') { this.input.resetSettings(); this._syncSettingsUI(); }
      if (action === 'reset-bindings') { this.input.resetBindings(); this._refreshBindingLabels(); }
    });

    this._buildSettingsRows();
    this._buildBindingRows();
  }

  _buildSettingsRows() {
    const defs = [
      ['mouseSensitivity','Mouse Sensitivity',.45,2.2,.05,2],
      ['controllerSensitivityX','Controller Horizontal',.45,2.2,.05,2],
      ['controllerSensitivityY','Controller Vertical',.45,2.2,.05,2],
      ['rightStickDeadzone','Right Stick Deadzone',.05,.35,.01,2],
      ['rightStickCurve','Right Stick Response Curve',1,2.5,.05,2],
      ['adsMultiplier','ADS Sensitivity Multiplier',.35,1,.05,2],
      ['fov','Field of View',75,115,1,0],
      ['reticleScale','Reticle Scale',.75,1.5,.05,2]
    ];
    const host = this._pauseEl.querySelector('#settings-controls');
    host.innerHTML = defs.map(([key,label,min,max,step]) => `<div class="setting-row"><label for="set-${key}">${label}</label><input id="set-${key}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}"><span class="setting-value" data-value="${key}"></span></div>`).join('') +
      `<div class="setting-row"><label for="set-invertControllerY">Invert Controller Y</label><input id="set-invertControllerY" data-setting="invertControllerY" type="checkbox"><span></span></div>
       <div class="setting-row"><label for="set-vibration">Controller Vibration</label><input id="set-vibration" data-setting="vibration" type="checkbox"><span></span></div>`;

    host.querySelectorAll('[data-setting]').forEach((control) => {
      control.addEventListener('input', () => {
        const key = control.dataset.setting;
        const value = control.type === 'checkbox' ? control.checked : Number(control.value);
        this.input.setSetting(key, value);
        this._syncSettingsUI();
      });
    });
    this._syncSettingsUI();
  }

  _buildBindingRows() {
    const host = this._pauseEl.querySelector('#binding-grid');
    host.innerHTML = Object.keys(ACTION_LABELS).map((action) => `<div class="bind-row"><span>${ACTION_LABELS[action]}</span><button class="bind-btn" data-bind="${action}"></button></div>`).join('');
    host.querySelectorAll('[data-bind]').forEach((button) => button.addEventListener('click', () => this._beginCapture(button.dataset.bind)));
    this._refreshBindingLabels();
  }

  _syncSettingsUI() {
    if (!this._pauseEl) return;
    for (const [key, value] of Object.entries(this.input.settings)) {
      const control = this._pauseEl.querySelector(`[data-setting="${key}"]`);
      if (!control) continue;
      if (control.type === 'checkbox') control.checked = !!value;
      else control.value = value;
      const out = this._pauseEl.querySelector(`[data-value="${key}"]`);
      if (out) out.textContent = key === 'fov' ? `${Math.round(value)}°` : Number(value).toFixed(2);
    }
  }

  _refreshBindingLabels() {
    if (!this._pauseEl) return;
    this._pauseEl.querySelectorAll('[data-bind]').forEach((button) => {
      button.textContent = this.input.getBindingLabel(button.dataset.bind);
    });
  }

  _beginCapture(action) {
    if (!this.input.hasGamepad()) {
      this._captureNote.textContent = 'Connect a controller, then select this action again.';
      this._captureNote.classList.add('show');
      return;
    }
    this.captureAction = action;
    this._captureNote.textContent = `${ACTION_LABELS[action]} // press a controller button… Escape cancels`;
    this._captureNote.classList.add('show');
  }

  _finishCapture(index) {
    if (!this.captureAction) return;
    this.input.setBinding(this.captureAction, index);
    this.captureAction = null;
    this._captureNote.textContent = 'Mapping saved.';
    setTimeout(() => { if (!this.captureAction) this._captureNote.classList.remove('show'); }, 900);
    this._refreshBindingLabels();
  }

  _cancelCapture() {
    this.captureAction = null;
    this._captureNote.classList.remove('show');
  }

  _handleMenuGamepad(index) {
    if (this.captureAction) return;
    if (index === 1) {
      if (this.settingsOpen) this._showPauseRoot(); else this._hidePause();
      return;
    }

    const focusables = [...this._pauseEl.querySelectorAll('button:not([disabled]), input:not([disabled])')].filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    let current = Math.max(0, focusables.indexOf(document.activeElement));
    if (index === 12 || index === 13) {
      current += index === 12 ? -1 : 1;
      current = (current + focusables.length) % focusables.length;
      focusables[current].focus();
      return;
    }
    if (index === 14 || index === 15) {
      const el = focusables[current];
      if (el?.type === 'range') {
        const step = Number(el.step) || 1;
        el.value = Number(el.value) + (index === 14 ? -step : step);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    if (index === 0) document.activeElement?.click?.();
  }

  _setPrompt(text) { if (this.bootPrompt) this.bootPrompt.textContent = text; }

  _requestLockFailSoft() {
    try {
      const maybePromise = this.input.requestLock();
      maybePromise?.catch?.((err) => console.warn('[Apex] Pointer lock unavailable; game remains playable.', err));
    } catch (err) {
      console.warn('[Apex] Pointer lock request failed; game remains running.', err);
    }
  }

  _start(fromGamepad = false) {
    if (this.started || this.starting) return;
    this.starting = true;
    this._setPrompt('Mobilizing region…');
    try {
      this.onStart();
      this.started = true;
      this.hud.show();
      this.bootScreen.style.display = 'none';
      if (!fromGamepad) this._requestLockFailSoft();
      console.info(`[Apex] World Spine started via ${fromGamepad ? 'controller' : 'pointer/keyboard'}.`);
    } catch (err) {
      this.started = false;
      console.error('[Apex] Start failed:', err);
      this._setPrompt('Start failed // open console');
      const detail = document.createElement('div');
      detail.id = 'start-error';
      detail.style.cssText = 'max-width:720px;padding:0 2rem;color:#ff6d91;font-size:.8rem;letter-spacing:.08em;text-transform:none;white-space:pre-wrap;';
      detail.textContent = err?.stack || err?.message || String(err);
      this.bootScreen.querySelector('#start-error')?.remove();
      this.bootScreen.appendChild(detail);
    } finally { this.starting = false; }
  }

  _togglePause() { this.paused ? this._hidePause() : this._showPause(); }

  _showPause() {
    if (!this.started || this.paused) return;
    this.paused = true;
    this.settingsOpen = false;
    this.engine.stop();
    document.exitPointerLock?.();
    this._pauseEl.style.display = 'block';
    this._showPauseRoot();
    setTimeout(() => this._pauseRoot.querySelector('button')?.focus(), 0);
  }

  _showSettings() {
    this.settingsOpen = true;
    this._pauseRoot.style.display = 'none';
    this._settingsRoot.style.display = 'block';
    this._syncSettingsUI();
    this._refreshBindingLabels();
    setTimeout(() => this._settingsRoot.querySelector('button,input')?.focus(), 0);
  }

  _showPauseRoot() {
    this.settingsOpen = false;
    this._cancelCapture();
    this._settingsRoot.style.display = 'none';
    this._pauseRoot.style.display = 'block';
    setTimeout(() => this._pauseRoot.querySelector('button')?.focus(), 0);
  }

  _hidePause() {
    if (!this.paused) return;
    this.paused = false;
    this.settingsOpen = false;
    this._cancelCapture();
    this._pauseEl.style.display = 'none';
    this.engine.start();
    if (!this.input.hasGamepad()) this._requestLockFailSoft();
  }

  _showGameOver() {
    this.engine.stop();
    document.exitPointerLock?.();
    const el = document.createElement('div');
    Object.assign(el.style, { position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'1.5rem',background:'radial-gradient(circle at 50% 40%, rgba(212,20,90,.25), #07050a 70%)',color:'#e8e2f0',fontFamily:'inherit',textAlign:'center' });
    el.innerHTML = `<div style="font-size:3.5rem;font-weight:900;letter-spacing:.15em;color:#ff2d6e;">GROUNDED</div><div style="letter-spacing:.3em;text-transform:uppercase;opacity:.75;">The world finally bought itself a moment</div><button class="apex-btn" id="retry-btn">Refuse again</button>`;
    document.body.appendChild(el);
    el.querySelector('#retry-btn').addEventListener('click', () => window.location.reload());
  }
}
