import * as THREE from 'three/webgpu';
import { bus, GameState } from '../core/GameState.js';
import { CoronaBlaster } from './weapons/CoronaBlaster.js';
import { Maw } from './weapons/Maw.js';
import { BlastMode } from './weapons/BlastMode.js';
import { FeralReversal } from './FeralReversal.js';

export class WeaponSystem {
  constructor(engine, input, camera, playerController, enemyManager) {
    this.engine = engine;
    this.input = input;
    this.camera = camera;
    this.player = playerController;
    this.enemyManager = enemyManager;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 80;
    this.weapons = { corona: new CoronaBlaster(this), maw: new Maw(this) };
    this.blastMode = new BlastMode(this);
    this.feralReversal = new FeralReversal(this);
    this.order = ['corona', 'maw'];
    this.activeKey = 'corona';
    this.active = this.weapons[this.activeKey];
    this._announce();
  }

  switchTo(key) {
    if (GameState.inBlastMode) return;
    if (!this.weapons[key] || key === this.activeKey) return;
    this.activeKey = key;
    this.active = this.weapons[key];
    this._announce();
  }

  _announce() { bus.emit('weaponChanged', { name: this.active.name, ammo: this.active.ammo, reserve: this.active.reserve }); }

  update(dt) {
    const input = this.input;
    if (GameState.inFeralReversal) { this.feralReversal.update(dt); return; }
    if (GameState.inBlastMode) this.blastMode.update(dt);
    else {
      this.active.update?.(dt);
      if (input.isDown('Digit1')) this.switchTo('corona');
      if (input.isDown('Digit2')) this.switchTo('maw');
      const wheel = input.consumeWheel();
      if (wheel !== 0) {
        const idx = this.order.indexOf(this.activeKey);
        const next = (idx + wheel + this.order.length) % this.order.length;
        this.switchTo(this.order[next]);
      }
      if (input.isMouseDown(0)) this.active.tryFire();
      if (input.isMouseDown(2)) this.active.tryAim?.(dt);
      if (input.isDown('KeyF') && GameState.blastCharge >= GameState.blastChargeMax) this.enterBlastMode();
    }
  }

  enterBlastMode() {
    GameState.inBlastMode = true;
    GameState.blastCharge = 0;
    bus.emit('blastCharge', 0);
    bus.emit('blastModeStart');
    bus.emit('weaponChanged', { name: this.blastMode.name, ammo: '∞', reserve: '—' });
    this.blastMode.enter();
  }

  exitBlastMode() {
    GameState.inBlastMode = false;
    bus.emit('blastModeEnd');
    this.blastMode.exit();
    this._announce();
  }

  hitscan({ spread = 0, damage = 10, pierceCount = 1 } = {}) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if (spread > 0) {
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
    }
    const origin=this.camera.getWorldPosition(new THREE.Vector3());
    this.raycaster.set(origin, dir);
    const targets = this.enemyManager.getHittableObjects();
    const worldTargets = this.enemyManager.getWorldHitObjects?.() || [];
    const enemyHits = this.raycaster.intersectObjects(targets, false);
    const worldHit = worldTargets.length ? this.raycaster.intersectObjects(worldTargets, false)[0] : null;
    const worldDistance = worldHit?.distance ?? Infinity;
    let remaining = pierceCount;
    const results = [];
    for (const hit of enemyHits) {
      if (remaining <= 0 || hit.distance >= worldDistance) break;
      const target = hit.object.userData.damageable;
      if (!target || target.dead || results.some((r)=>r.target===target)) continue;
      target.takeDamage(damage, hit.point);
      results.push({ target, point: hit.point });
      remaining -= 1;
    }
    if (worldHit && remaining > 0) {
      let normal=new THREE.Vector3(0,1,0);
      if(worldHit.face?.normal) normal.copy(worldHit.face.normal).transformDirection(worldHit.object.matrixWorld).normalize();
      bus.emit('worldHit', { point: worldHit.point.clone(), normal, object: worldHit.object });
    } else if(results.length===0) bus.emit('shotMiss', { origin, direction: dir.clone() });
    return results;
  }
}
