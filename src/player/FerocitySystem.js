import { bus, GameState } from '../core/GameState.js';

const KILL_BASE = 10;
const POSITIONAL_BONUS = 8;
const IDLE_DECAY_DELAY = 5;
const DECAY_RATE = 6;
const DECAY_RATE_STATIONARY = 14;

export class FerocitySystem {
  constructor(playerController) {
    this.player = playerController;
    this._sinceLastGain = 0;
    bus.on('enemyDied', () => this._onKill());
  }

  _onKill() {
    const p = this.player;
    const positional = p.onWall || !p.grounded || p.sliding;
    GameState.addFerocity(KILL_BASE + (positional ? POSITIONAL_BONUS : 0));
    this._sinceLastGain = 0;
  }

  update(dt) {
    this._sinceLastGain += dt;
    if (this._sinceLastGain < IDLE_DECAY_DELAY) return;
    const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    const rate = speed < 0.5 ? DECAY_RATE_STATIONARY : DECAY_RATE;
    GameState.decayFerocity(rate * dt);
  }
}
