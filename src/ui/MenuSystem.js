import { bus } from '../core/GameState.js';

export class MenuSystem {
  constructor(input, engine, hud, onStart) {
    this.input = input;
    this.engine = engine;
    this.hud = hud;
    this.onStart = onStart;
    this.bootScreen = document.getElementById('boot-screen');
    this.started = false;
    this.bootScreen.addEventListener('click', () => this._start());
    this.input.onLockChange = (locked) => {
      if (!locked && this.started) this._showPause();
      else if (locked) this._hidePause();
    };
    bus.on('playerDied', () => this._showGameOver());
  }

  _start() {
    if (this.started) { this.input.requestLock(); return; }
    this.started = true;
    this.bootScreen.style.display = 'none';
    this.hud.show();
    this.input.requestLock();
    this.onStart();
  }

  _showPause() {
    if (this._pauseEl) { this._pauseEl.style.display = 'flex'; return; }
    const el = document.createElement('div');
    el.id = 'pause-overlay';
    Object.assign(el.style, {
      position: 'fixed', inset: 0, zIndex: 40, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem',
      background: 'rgba(7,5,10,0.75)', cursor: 'pointer', color: '#e8e2f0',
      fontFamily: 'inherit', letterSpacing: '0.25em', textTransform: 'uppercase'
    });
    el.innerHTML = `<div style="font-size:2rem;font-weight:800;">Paused</div><div style="font-size:0.85rem;opacity:0.7;">Click to resume</div>`;
    el.addEventListener('click', () => this.input.requestLock());
    document.body.appendChild(el);
    this._pauseEl = el;
  }

  _hidePause() { if (this._pauseEl) this._pauseEl.style.display = 'none'; }

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
    el.innerHTML = `<div style="font-size:3.5rem;font-weight:900;letter-spacing:0.15em;color:#ff2d6e;">GROUNDED</div><div style="letter-spacing:0.3em;text-transform:uppercase;opacity:0.75;">Even apex predators bleed</div><div style="margin-top:1.5rem;padding:0.85rem 2.2rem;border:1px solid rgba(232,226,240,0.35);letter-spacing:0.2em;text-transform:uppercase;cursor:pointer;" id="retry-btn">Retry</div>`;
    document.body.appendChild(el);
    el.querySelector('#retry-btn').addEventListener('click', () => window.location.reload());
  }
}
