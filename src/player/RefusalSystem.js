import { bus, GameState } from '../core/GameState.js';

/**
 * REFUSAL turns overwhelming opposition into progression.
 *
 * The prototype accelerates the curve intentionally so one play session can
 * demonstrate the fantasy: pressure -> survival -> adaptation -> new rules.
 */
export class RefusalSystem {
  constructor(playerController) {
    this.player = playerController;
    this.lowHealthTimer = 0;
    this.combatTimer = 0;
    this.lastTier = GameState.refusalTier;

    bus.on('enemyDied', () => this._onKill());
    bus.on('playerDamaged', ({ amount, health, maxHealth }) => this._onDamaged(amount, health / maxHealth));
    bus.on('refusalTier', (tier) => this._onTierUp(tier));
  }

  _onKill() {
    const pressureFactor = 1 + GameState.pressure / 55;
    const movementBonus = (!this.player.grounded || this.player.sliding || this.player.onWall || this.player.flightMode) ? 1.35 : 1;
    GameState.addRefusal(7.5 * pressureFactor * movementBonus);
  }

  _onDamaged(amount, healthPct) {
    GameState.addRefusal(amount * (healthPct < .35 ? 1.35 : .65));
    this.combatTimer = 0;
  }

  _onTierUp(tier) {
    if (tier <= this.lastTier) return;
    this.lastTier = tier;
    const oldMax = GameState.maxHealth;
    GameState.maxHealth = 100 + tier * 42;
    GameState.health = Math.min(GameState.maxHealth, GameState.health + 34 + tier * 12 + (GameState.maxHealth - oldMax));
    bus.emit('playerHealth', GameState.health / GameState.maxHealth);
    bus.emit('refusalBreakthrough', { tier, maxHealth: GameState.maxHealth });
  }

  update(dt) {
    this.combatTimer += dt;
    const hpPct = GameState.health / Math.max(1, GameState.maxHealth);
    if (hpPct < .32 && GameState.pressure > 35) {
      this.lowHealthTimer += dt;
      GameState.addRefusal(dt * (5 + GameState.pressure * .035));
    } else {
      this.lowHealthTimer = Math.max(0, this.lowHealthTimer - dt * 2);
    }

    // Merely remaining in a high-pressure fight slowly teaches the body to
    // survive it. This is intentionally modest compared with kills/damage.
    if (GameState.pressure > 55) GameState.addRefusal(dt * (1.25 + GameState.pressure * .012));
  }
}
