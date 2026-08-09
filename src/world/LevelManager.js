import { WaveSpawner } from '../enemies/WaveSpawner.js';
import { Pickup } from './Pickup.js';
import { bus, GameState } from '../core/GameState.js';
import { GraveyardLevel } from './levels/arena_graveyard.js';
import { CathedralLevel } from './levels/arena_cathedral.js';

const MANIFEST = [GraveyardLevel, CathedralLevel];

export class LevelManager {
  constructor(engine, playerController) {
    this.engine = engine;
    this.player = playerController;
    this.index = 0;
    this.current = null;
    this.spawner = null;
    this.pickups = [];
    bus.on('bossDefeated', () => this._scheduleAdvance());
  }

  loadCurrent() {
    const def = MANIFEST[this.index];
    this.current = def;
    const built = def.build(this.engine);
    this._built = built;
    GameState.currentAreaId = def.id;
    bus.emit('areaLoaded', { id: def.id, name: def.name });
    this.spawner = new WaveSpawner(
      this.engine, this.player, built.spawnPoints, built.waveDefs, built.bossDef
    );
    this.spawner.start();
    this.pickups = built.pickupSpots.map((p) => new Pickup(this.engine, p.type, p.pos));
    return def.playerStart;
  }

  _scheduleAdvance() { setTimeout(() => this.advance(), 2500); }

  advance() {
    this._unload();
    this.index = (this.index + 1) % MANIFEST.length;
    const start = this.loadCurrent();
    bus.emit('areaAdvance', { spawn: start });
    return start;
  }

  _unload() {
    if (this._built?.group) this.engine.scene.remove(this._built.group);
    this.pickups.forEach((p) => { if (!p.collected) this.engine.scene.remove(p.mesh); });
  }

  update(dt) {
    this.spawner?.update(dt);
    const playerPos = this.player.position;
    for (const p of this.pickups) p.update(dt, playerPos);
    this.pickups = this.pickups.filter((p) => !p.collected);
  }

  getHittableObjects() {
    return this.spawner ? this.spawner.getHittableObjects() : [];
  }

  getWorldHitObjects() {
    return this._built?.worldHitObjects || [];
  }
}
