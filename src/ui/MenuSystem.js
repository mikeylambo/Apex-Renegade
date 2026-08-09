import { bus } from '../core/GameState.js';

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

    // A controller can start the game without pointer lock. This matters on
    // browsers that reject pointer-lock requests until a mouse/pointer gesture.
    this.input.onGamepadActivity = () => {
      if (!this.started) this._start(true);
      else this._hidePause();
    };

    this.input.onGamepadChange = ({ connected }) => {
      if (!this.started && connected) this._setPrompt('Controller detected // press any button');
    };

    this.input.onLockChange = (locked) => {
      // Losing pointer lock is only a pause condition for mouse/keyboard play.
      // A connected controller remains fully playable without pointer lock.
      if (!locked && this.started && !this.input.hasGamepad()) this._showPause();
      else if (locked || this.input.hasGamepad()) this._hidePause();
    };

    bus.on('playerDied', () => this._showGameOver());
    this._setPrompt(this.input.hasGamepad()
      ? 'Controller detected // press any button'
      : 'Ready // click to enter the war');
  }

  _setPrompt(text) {
    if (this.bootPrompt) this.bootPrompt.textContent = text;
  }

  _requestLockFailSoft() {
    try {
      const maybePromise = this.input.requestLock();
      maybePromise?.catch?.((err) => console.warn('[Apex] Pointer lock unavailable; game remains playable.', err));
    } catch (err) {
      console.warn('[Apex] Pointer lock request failed; game remains running.', err);
    }
  }

  _start(fromGamepad = false) {
    if (this.started) {
      if (fromGamepad) this._hidePause();
      else this._requestLockFailSoft();
      return;
    }
    if (this.starting) return;

    this.starting = true;
    this._setPrompt('Mobilizing region…');

    try {
      this.onStart();
      this.started = true;
      this.hud.show();
      this.bootScreen.style.display = 'none';
      if (!fromGamepad) this._requestLockFailSoft();
      console.info(`[Apex] Open War Sandbox started via ${fromGamepad ? 'controller' : 'pointer/keyboard'}.`);
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
    } finally {
      this.starting = false;
    }
  }

  _showPause() {
    if (this.input.hasGamepad()) return;
    if (this._pauseEl) { this._pauseEl.style.display = 'flex'; return; }
    const el = document.createElement('div');
    el.id = 'pause-overlay';
    Object.assign(el.style, {
      position: 'fixed', inset: 0, zIndex: 40, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem',
      background: 'rgba(7,5,10,0.75)', cursor: 'pointer', color: '#e8e2f0',
      fontFamily: 'inherit', letterSpacing: '0.25em', textTransform: 'uppercase'
    });
    el.innerHTML = `<div style="font-size:2rem;font-weight:800;">Paused</div>
      <div style="font-size:0.85rem;opacity:0.7;">Click to resume</div>`;
    el.addEventListener('pointerdown', () => this._requestLockFailSoft());
    document.body.appendChild(el);
    this._pauseEl = el;
  }

  _hidePause() {
    if (this._pauseEl) this._pauseEl.style.display = 'none';
  }

  _showGameOver() {
    this.engine.stop();
    document.exitPointerLock?.();
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem',
      background: 'radial-gradient(circle at 50% 40%, rgba(212,20,90,0.25), #07050a 70%)',
      color: '#e8e2f0', fontFamily: 'inherit', textAlign: 'center'
    });
    el.innerHTML = `
      <div style="font-size:3.5rem;font-weight:900;letter-spacing:0.15em;color:#ff2d6e;">GROUNDED</div>
      <div style="letter-spacing:0.3em;text-transform:uppercase;opacity:0.75;">The world finally bought itself a moment</div>
      <div style="margin-top:1.5rem;padding:0.85rem 2.2rem;border:1px solid rgba(232,226,240,0.35);letter-spacing:0.2em;text-transform:uppercase;cursor:pointer;" id="retry-btn">Refuse again</div>
    `;
    document.body.appendChild(el);
    el.querySelector('#retry-btn').addEventListener('click', () => window.location.reload());
  }
}
