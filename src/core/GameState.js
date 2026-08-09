/**
 * Lightweight global runtime state + event bus.
 *
 * Pass VI pivots the prototype from arena-wave progression to two coupled
 * open-world meters:
 *   PRESSURE — how much force the region is committing to stop the Renegade.
 *   REFUSAL  — how much the Renegade has adapted to surviving that pressure.
 *
 * Ferocity remains in the data model for backwards compatibility with the old
 * arena modules, but the open-war prototype does not drive gameplay from it.
 */
class EventBus {
  constructor() { this.listeners = new Map(); }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }
  emit(event, payload) { this.listeners.get(event)?.forEach((cb) => cb(payload)); }
}

export const bus = new EventBus();

export const GameState = {
  health: 100,
  maxHealth: 100,
  blastCharge: 0,
  blastChargeMax: 100,
  inBlastMode: false,
  inFeralReversal: false,

  // Legacy combat-expression state kept for older modules.
  ferocity: 0,
  ferocityMax: 100,
  ferocityTier: 0,

  // Open-world war state.
  pressure: 0,
  pressureMax: 100,
  pressureStage: 0,
  pressureStageName: 'UNNOTICED',
  refusal: 0,
  refusalMax: 1000,
  refusalTier: 0,
  contacts: 0,

  deathInterceptor: null,
  currentAreaId: 'scar_outskirts',
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

  setPressure(value, stage = this.pressureStage, stageName = this.pressureStageName) {
    this.pressure = Math.max(0, Math.min(this.pressureMax, value));
    this.pressureStage = stage;
    this.pressureStageName = stageName;
    bus.emit('pressure', {
      value: this.pressure,
      pct: this.pressure / this.pressureMax,
      stage,
      stageName
    });
  },

  setContacts(count) {
    this.contacts = Math.max(0, Math.floor(count));
    bus.emit('contacts', this.contacts);
  },

  addRefusal(amount) {
    if (amount <= 0) return;
    this.refusal = Math.min(this.refusalMax, this.refusal + amount);
    const thresholds = [0, 120, 300, 560, 840];
    let nextTier = 0;
    for (let i = 1; i < thresholds.length; i++) if (this.refusal >= thresholds[i]) nextTier = i;
    if (nextTier !== this.refusalTier) {
      this.refusalTier = nextTier;
      bus.emit('refusalTier', nextTier);
    }
    bus.emit('refusal', {
      value: this.refusal,
      pct: this.refusal / this.refusalMax,
      tier: this.refusalTier
    });
  },

  damagePlayer(amount) {
    const wouldBeHealth = this.health - amount;
    if (wouldBeHealth <= 0 && !this.inFeralReversal && this.deathInterceptor?.()) return this.health;
    this.health = Math.max(0, wouldBeHealth);
    bus.emit('playerDamaged', { amount, health: this.health, maxHealth: this.maxHealth });
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
