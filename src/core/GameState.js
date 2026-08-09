/**
 * Small pub/sub event bus + shared mutable game state. Deliberately not a
 * heavyweight store — this game is small enough that a plain object with
 * an emitter covers UI sync, save/progression, and cross-system signals
 * (enemy died -> spawner, player hit -> HUD, wave cleared -> level manager).
 */
class EventBus {
  constructor() { this.listeners = new Map(); }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event).delete(cb);
  }
  emit(event, payload) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }
}

export const bus = new EventBus();

export const GameState = {
  health: 100,
  maxHealth: 100,
  blastCharge: 0,
  blastChargeMax: 100,
  inBlastMode: false,
  inFeralReversal: false,

  ferocity: 0,
  ferocityMax: 100,
  ferocityTier: 0,

  deathInterceptor: null,

  currentAreaId: 'graveyard',
  currentWave: 1,
  score: 0,
  kills: 0,

  addBlastCharge(amount) {
    this.blastCharge = Math.min(this.blastChargeMax, this.blastCharge + amount);
    bus.emit('blastCharge', this.blastCharge / this.blastChargeMax);
  },

  addFerocity(amount) {
    this.ferocity = Math.min(this.ferocityMax, this.ferocity + amount);
    this._updateFerocityTier();
    bus.emit('ferocity', this.ferocity / this.ferocityMax);
  },

  decayFerocity(amount) {
    if (this.ferocity <= 0) return;
    this.ferocity = Math.max(0, this.ferocity - amount);
    this._updateFerocityTier();
    bus.emit('ferocity', this.ferocity / this.ferocityMax);
  },

  _updateFerocityTier() {
    const nextTier = this.ferocity >= 67 ? 2 : this.ferocity >= 34 ? 1 : 0;
    if (nextTier !== this.ferocityTier) {
      this.ferocityTier = nextTier;
      bus.emit('ferocityTier', nextTier);
    }
  },

  damagePlayer(amount) {
    const wouldBeHealth = this.health - amount;
    if (wouldBeHealth <= 0 && !this.inFeralReversal && this.deathInterceptor?.()) {
      return this.health;
    }
    this.health = Math.max(0, wouldBeHealth);
    bus.emit('playerHealth', this.health / this.maxHealth);
    if (this.health <= 0) bus.emit('playerDied');
    return this.health;
  },

  healPlayer(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    bus.emit('playerHealth', this.health / this.maxHealth);
  },

  registerKill(points = 100) {
    this.kills += 1;
    this.score += points;
    bus.emit('kill', { kills: this.kills, score: this.score });
  }
};
