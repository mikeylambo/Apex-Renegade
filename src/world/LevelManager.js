import { OpenWorldWarDirector } from '../enemies/OpenWorldWarDirector.js';
import { Pickup } from './Pickup.js';
import { bus, GameState } from '../core/GameState.js';
import { OpenWorldWarzoneLevel } from './levels/openworld_warzone.js';

// Pass VI deliberately focuses on one oversized region. We are proving the
// world/combat grammar before multiplying content.
const MANIFEST = [OpenWorldWarzoneLevel];

export class LevelManager {
  constructor(engine, playerController) {
    this.engine = engine;
    this.player = playerController;
    this.index = 0;
    this.current = null;
    this.spawner = null;
    this.pickups = [];
  }

  loadCurrent() {
    const def = MANIFEST[this.index];
    this.current = def;
    const built = def.build(this.engine);
    this._built = built;

    GameState.currentAreaId = def.id;
    bus.emit('areaLoaded', { id: def.id, name: def.name });

    this.spawner = new OpenWorldWarDirector(
      this.engine,
      this.player,
      built.arrivalPoints,
      built.swarmCorridors
    );
    this.spawner.start();

    this.pickups = built.pickupSpots.map((p) => new Pickup(this.engine, p.type, p.pos));
    return def.playerStart;
  }

  update(dt) {
    this.spawner?.update(dt);
    const playerPos = this.player.position;
    for (const p of this.pickups) p.update(dt, playerPos);
    this.pickups = this.pickups.filter((p) => !p.collected);
  }

  getHittableObjects() { return this.spawner?.getHittableObjects?.() || []; }
  getEnemies() { return this.spawner?.getEnemies?.() || []; }
  getWorldHitObjects() { return this._built?.worldHitObjects || []; }
}
