import * as THREE from 'three/webgpu';
import { Enemy } from './Enemy.js';
import { ENEMY_ARCHETYPES } from './EnemyTypes.js';
import { bus, GameState } from '../core/GameState.js';

const STAGES = [
  { min: 0,  name: 'UNNOTICED',         active: 5,  swarm: 28,  distant: 120, interval: 8.0 },
  { min: 12, name: 'RESPONSE',          active: 10, swarm: 70,  distant: 240, interval: 5.7 },
  { min: 30, name: 'MOBILIZATION',      active: 18, swarm: 125, distant: 430, interval: 4.0 },
  { min: 55, name: 'REGIONAL SIEGE',    active: 28, swarm: 190, distant: 660, interval: 2.8 },
  { min: 80, name: 'TOTAL CONTAINMENT', active: 40, swarm: 260, distant: 920, interval: 1.9 }
];

function stageForPressure(p) {
  let index = 0;
  for (let i = 1; i < STAGES.length; i++) if (p >= STAGES[i].min) index = i;
  return index;
}

class SwarmLayer {
  constructor(engine, corridors, maxCount = 280) {
    this.engine = engine;
    this.corridors = corridors;
    this.maxCount = maxCount;
    this.count = 0;
    this.positions = Array.from({ length: maxCount }, () => new THREE.Vector3());
    this.speeds = new Float32Array(maxCount);
    this.laneIndex = new Uint16Array(maxCount);
    this.dummy = new THREE.Object3D();

    const geo = new THREE.CylinderGeometry(.34, .42, 1.45, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x111821, roughness: .72, metalness: .34 });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    engine.scene.add(this.mesh);
    for (let i = 0; i < maxCount; i++) this._reset(i, true);
    this.setCount(24);
  }

  _reset(i, initial = false) {
    const lane = Math.floor(Math.random() * this.corridors.length);
    this.laneIndex[i] = lane;
    const c = this.corridors[lane];
    const t = initial ? Math.random() : .78 + Math.random() * .22;
    this.positions[i].lerpVectors(c.end, c.start, t);
    this.positions[i].x += (Math.random() - .5) * c.width;
    this.positions[i].z += (Math.random() - .5) * c.width;
    this.positions[i].y = .8;
    this.speeds[i] = 3.2 + Math.random() * 2.9;
  }

  setCount(n) { this.count = Math.min(this.maxCount, Math.max(0, Math.floor(n))); this.mesh.count = this.count; }

  update(dt, playerPos, promote) {
    for (let i = 0; i < this.count; i++) {
      const p = this.positions[i];
      const c = this.corridors[this.laneIndex[i]];
      const target = playerPos.distanceToSquared(p) < 150 * 150 ? playerPos : c.end;
      const dx = target.x - p.x, dz = target.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      p.x += (dx / len) * this.speeds[i] * dt;
      p.z += (dz / len) * this.speeds[i] * dt;

      if (playerPos.distanceToSquared(p) < 58 * 58) {
        if (promote(p)) this._reset(i);
        else {
          // Flow around the combat bubble instead of piling into one point.
          p.x += (-dz / len) * dt * 2.1;
          p.z += (dx / len) * dt * 2.1;
        }
      }

      this.dummy.position.copy(p);
      this.dummy.scale.set(.82, .95 + (i % 5) * .035, .82);
      this.dummy.rotation.y = Math.atan2(dx, dz);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class DistantArmyLayer {
  constructor(engine, corridors, maxCount = 1000) {
    this.engine = engine;
    this.corridors = corridors;
    this.maxCount = maxCount;
    this.count = 0;
    this.tick = 0;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxCount * 3);
    this.speeds = new Float32Array(maxCount);
    this.lanes = new Uint16Array(maxCount);
    for (let i = 0; i < maxCount; i++) this._reset(i, true);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xa6b2c3, size: 1.05, transparent: true, opacity: .38, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    engine.scene.add(this.points);
    this.setCount(100);
  }

  _reset(i, initial = false) {
    const lane = Math.floor(Math.random() * this.corridors.length);
    const c = this.corridors[lane];
    this.lanes[i] = lane;
    const t = initial ? Math.random() : .88 + Math.random() * .12;
    const x = THREE.MathUtils.lerp(c.end.x, c.start.x, t) + (Math.random() - .5) * c.width * 2.4;
    const z = THREE.MathUtils.lerp(c.end.z, c.start.z, t) + (Math.random() - .5) * c.width * 2.4;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = .55 + Math.random() * 1.1;
    this.positions[i * 3 + 2] = z;
    this.speeds[i] = .9 + Math.random() * 1.8;
  }

  setCount(n) {
    this.count = Math.min(this.maxCount, Math.max(0, Math.floor(n)));
    this.points.geometry.setDrawRange(0, this.count);
  }

  update(dt) {
    this.tick += dt;
    if (this.tick < .12) return;
    const step = this.tick; this.tick = 0;
    for (let i = 0; i < this.count; i++) {
      const lane = this.corridors[this.lanes[i]];
      const ix = i * 3;
      const x = this.positions[ix], z = this.positions[ix + 2];
      const dx = lane.end.x - x, dz = lane.end.z - z;
      const len = Math.hypot(dx, dz) || 1;
      this.positions[ix] += dx / len * this.speeds[i] * step;
      this.positions[ix + 2] += dz / len * this.speeds[i] * step;
      if (Math.hypot(lane.end.x - this.positions[ix], lane.end.z - this.positions[ix + 2]) < 105) this._reset(i);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/**
 * Regional escalation simulation. There are no authored waves. The director
 * continuously raises/lowers regional pressure and expresses it through three
 * simulation layers:
 *   - full Enemy actors near the player;
 *   - cheap instanced swarm bodies approaching via roads/plazas;
 *   - very cheap distant formation points that sell army scale.
 */
export class OpenWorldWarDirector {
  constructor(engine, player, arrivalPoints, swarmCorridors) {
    this.engine = engine;
    this.player = player;
    this.arrivalPoints = arrivalPoints;
    this.swarmCorridors = swarmCorridors;
    this.enemies = [];
    this.active = false;
    this.pressure = 0;
    this.stage = 0;
    this.spawnTimer = 1.2;
    this.timeSinceCombat = 999;
    this.swarm = new SwarmLayer(engine, swarmCorridors, 280);
    this.distant = new DistantArmyLayer(engine, swarmCorridors, 1000);

    bus.on('enemyDied', () => {
      this.timeSinceCombat = 0;
      this.pressure = Math.min(100, this.pressure + 3.1 + this.stage * .7);
    });
    bus.on('playerDamaged', () => { this.timeSinceCombat = 0; this.pressure = Math.min(100, this.pressure + .75); });
    bus.on('weaponFired', () => { if (this.pressure < 10) this.pressure += .035; this.timeSinceCombat = 0; });
  }

  start() {
    this.active = true;
    for (let i = 0; i < 5; i++) this._spawnFull(i % 4 === 0 ? 'enforcer' : 'hollow');
    this._syncStage(true);
  }

  _closestArrival() {
    const playerPos = this.player.position;
    let pool = this.arrivalPoints.filter((p) => p.distanceTo(playerPos) > 70);
    if (!pool.length) pool = this.arrivalPoints;
    pool.sort((a, b) => a.distanceToSquared(playerPos) - b.distanceToSquared(playerPos));
    const slice = pool.slice(0, Math.min(5, pool.length));
    return slice[Math.floor(Math.random() * slice.length)] || this.arrivalPoints[0];
  }

  _spawnFull(typeId = null, position = null) {
    const type = typeId || (this.stage >= 2 && Math.random() < .34 ? 'enforcer' : 'hollow');
    const archetype = ENEMY_ARCHETYPES[type];
    if (!archetype) return null;
    const origin = position?.clone?.() || this._closestArrival().clone();
    origin.x += (Math.random() - .5) * 12;
    origin.z += (Math.random() - .5) * 12;
    origin.y = 1;
    const enemy = new Enemy(this.engine, archetype, origin, this.player);
    enemy.forceEngage?.();
    this.enemies.push(enemy);
    return enemy;
  }

  _promoteSwarm = (position) => {
    const live = this.enemies.filter((e) => !e.dead).length;
    const target = STAGES[this.stage].active;
    if (live >= target) return false;
    this._spawnFull(null, position);
    return true;
  };

  _syncStage(force = false) {
    const next = stageForPressure(this.pressure);
    if (force || next !== this.stage) {
      this.stage = next;
      bus.emit('pressureStage', { stage: next, name: STAGES[next].name });
      if (!force) bus.emit('mobilization', { stage: next, name: STAGES[next].name });
    }
    const s = STAGES[this.stage];
    this.swarm.setCount(s.swarm);
    this.distant.setCount(s.distant);
    GameState.setPressure(this.pressure, this.stage, s.name);
  }

  update(dt) {
    if (!this.active) return;
    this.timeSinceCombat += dt;

    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathTimer > 0);

    const live = this.enemies.filter((e) => !e.dead).length;
    const s = STAGES[this.stage];
    const inCombat = live > 0 && this.timeSinceCombat < 12;
    if (inCombat) this.pressure = Math.min(100, this.pressure + dt * (.22 + live * .006));
    else if (this.timeSinceCombat > 20) this.pressure = Math.max(0, this.pressure - dt * .42);

    this._syncStage();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && live < s.active) {
      const deficit = s.active - live;
      const group = Math.min(deficit, 1 + Math.floor(this.stage * .75));
      for (let i = 0; i < group; i++) this._spawnFull();
      this.spawnTimer = s.interval * (.78 + Math.random() * .5);
      bus.emit('reinforcementsInbound', { count: group, stage: this.stage });
    }

    const playerPos = this.player.position;
    this.swarm.update(dt, playerPos, this._promoteSwarm);
    this.distant.update(dt);
    GameState.setContacts(live + this.swarm.count + this.distant.count);
  }

  getHittableObjects() {
    const objs = [];
    for (const e of this.enemies) if (!e.dead) objs.push(...e.getHitObjects());
    return objs;
  }

  getEnemies() { return this.enemies.filter((e) => !e.dead); }
}
