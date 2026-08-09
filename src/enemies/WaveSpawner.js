import * as THREE from 'three/webgpu';
import { Enemy } from './Enemy.js';
import { ENEMY_ARCHETYPES } from './EnemyTypes.js';
import { bus, GameState } from '../core/GameState.js';
import { BossController } from './BossController.js';
import { TearRupture } from './TearRupture.js';

const REINFORCEMENT_CAP = 20;

export class WaveSpawner {
  constructor(engine, playerController, spawnPoints, waveDefs, bossDef = null) {
    this.engine = engine;
    this.player = playerController;
    this.spawnPoints = spawnPoints;
    this.waveDefs = waveDefs;
    this.bossDef = bossDef;
    this.enemies = [];
    this.ruptures = [];
    this.waveIndex = 0;
    this.betweenWavesTimer = 3;
    this.active = false;
    this.boss = null;
  }

  start() { this.active = true; this._beginWave(); }

  _beginWave() {
    const def = this.waveDefs[this.waveIndex] ?? this._proceduralWave(this.waveIndex);
    GameState.currentWave = this.waveIndex + 1;
    bus.emit('waveStart', GameState.currentWave);
    this.ruptures = [];
    if (this.bossDef && (this.waveIndex + 1) === this.bossDef.atWave) { this._spawnBoss(); return; }
    for (const spawn of def.composition) for (let i = 0; i < spawn.count; i++) this._spawnEnemy(spawn.type);
    if (def.ruptureCount) this._spawnRuptures(def);
  }

  _spawnRuptures(def) {
    const pool = def.composition.map((c) => c.type);
    const available = [...this.spawnPoints];
    for (let i = 0; i < def.ruptureCount; i++) {
      if (available.length === 0) break;
      const idx = Math.floor(Math.random() * available.length);
      const point = available.splice(idx, 1)[0];
      const rupture = new TearRupture(this.engine, point, pool, (type, pos) => {
        const enemy = this._spawnEnemy(type, pos);
        enemy.sourceRupture = rupture;
      });
      this.ruptures.push(rupture);
    }
  }

  _proceduralWave(index) {
    const count = 4 + Math.floor(index * 1.5);
    const gunnerRatio = Math.min(0.4, index * 0.04);
    const gunners = Math.round(count * gunnerRatio);
    return { composition: [{ type: 'hollow', count: count - gunners }, { type: 'enforcer', count: gunners }] };
  }

  _spawnEnemy(typeId, position) {
    const point = position || this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
    const archetype = ENEMY_ARCHETYPES[typeId];
    const enemy = new Enemy(this.engine, archetype, point.clone(), this.player);
    this.enemies.push(enemy);
    if (archetype.callsReinforcements) {
      enemy.onRequestReinforcement = () => {
        if (this.enemies.filter((e) => !e.dead).length < REINFORCEMENT_CAP) this._spawnEnemy('hollow');
      };
    }
    return enemy;
  }

  _spawnBoss() {
    const point = this.spawnPoints[0];
    this.boss = new BossController(this.engine, this.bossDef, point.clone(), this.player);
    bus.emit('bossSpawn', this.bossDef.name);
  }

  update(dt) {
    if (!this.active) return;
    for (const e of this.enemies) e.update(dt);
    for (const e of this.enemies) {
      if (e.dead && e.sourceRupture) {
        e.sourceRupture.notifySpawnDied();
        e.sourceRupture = null;
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathTimer > 0);
    for (const r of this.ruptures) r.update(dt);
    if (this.boss) {
      this.boss.update(dt);
      if (this.boss.dead) {
        bus.emit('bossDefeated', this.bossDef.name);
        this.boss = null;
        this._advanceWave();
      }
      return;
    }
    const aliveCount = this.enemies.filter((e) => !e.dead).length;
    const rupturesAlive = this.ruptures.some((r) => !r.dead);
    if (aliveCount === 0 && !rupturesAlive) {
      this.betweenWavesTimer -= dt;
      if (this.betweenWavesTimer <= 0) {
        this.betweenWavesTimer = 3;
        this._advanceWave();
      } else bus.emit('waveClear', this.betweenWavesTimer);
    }
  }

  _advanceWave() { this.waveIndex += 1; this._beginWave(); }

  getHittableObjects() {
    const objs = [];
    for (const e of this.enemies) if (!e.dead) objs.push(...e.getHitObjects());
    for (const r of this.ruptures) if (!r.dead) objs.push(...r.getHitObjects());
    if (this.boss && !this.boss.dead) objs.push(...this.boss.getHitObjects());
    return objs;
  }
}
