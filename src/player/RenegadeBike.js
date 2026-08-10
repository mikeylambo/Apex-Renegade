import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bus, GameState } from '../core/GameState.js';

function rounded(size, mat, radius = .08, segments = 3) {
  const maxR = Math.min(...size.map((v) => v * .18));
  return new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segments, Math.min(radius, maxR)), mat);
}

function buildBike(mats) {
  const root = new THREE.Group();
  const dark = mats.blackMetal, steel = mats.metal, pale = mats.paleMetal, comp = mats.composite, glow = mats.spectral;

  const body = rounded([1.05, .58, 2.55], dark, .15, 4); body.position.y = .76; root.add(body);
  const spine = rounded([.46, .32, 2.85], steel, .10, 4); spine.position.set(0, 1.02, -.08); spine.rotation.x = -.035; root.add(spine);
  const saddle = rounded([.62, .18, .76], comp, .08, 3); saddle.position.set(0, 1.24, .36); saddle.rotation.x = -.08; root.add(saddle);
  const nose = rounded([.72, .45, .78], pale, .12, 4); nose.position.set(0, .93, -1.42); nose.rotation.x = -.08; root.add(nose);
  const tail = rounded([.78, .34, .72], dark, .12, 4); tail.position.set(0, .88, 1.45); root.add(tail);

  for (const side of [-1, 1]) {
    const flank = rounded([.18, .34, 1.82], comp, .06, 3); flank.position.set(side * .53, .80, .08); flank.rotation.z = side * .055; root.add(flank);
    const conduit = rounded([.045, .06, 1.58], glow, .016, 2); conduit.position.set(side * .645, .94, -.02); root.add(conduit);
    const bar = rounded([.48, .06, .08], pale, .025, 2); bar.position.set(side * .34, 1.38, -1.18); bar.rotation.z = side * .15; root.add(bar);
  }

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: .78, metalness: .18 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x7f8b98, roughness: .28, metalness: .91 });
  const wheels = [];
  for (const z of [-1.28, 1.22]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.53, .14, 10, 28), wheelMat); wheel.position.set(0, .52, z); wheel.rotation.y = Math.PI / 2; root.add(wheel); wheels.push(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .84, 14), hubMat); hub.position.set(0, .52, z); hub.rotation.z = Math.PI / 2; root.add(hub);
  }

  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(.9, 4.8),
    new THREE.MeshBasicMaterial({ color: 0x7066ef, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  wake.rotation.x = -Math.PI / 2; wake.position.set(0, .08, 2.5); root.add(wake); root.userData.wake = wake;

  const spectralLight = new THREE.PointLight(0x8075ff, 0, 18, 1.6);
  spectralLight.position.set(0, .7, .65); root.add(spectralLight); root.userData.spectralLight = spectralLight;

  // Third-person silhouette proxy until the authored Renegade model is ready.
  const rider = new THREE.Group();
  const torso = rounded([.52, .78, .32], dark, .12, 4); torso.position.set(0, 1.78, .18); torso.rotation.x = -.20; rider.add(torso);
  const chest = rounded([.58, .24, .36], pale, .08, 3); chest.position.set(0, 2.02, .05); chest.rotation.x = -.18; rider.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 16, 12), mats.blackStone); head.position.set(0, 2.42, -.02); rider.add(head);
  const visor = rounded([.34, .10, .08], glow, .035, 3); visor.position.set(0, 2.44, -.20); rider.add(visor);
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = rounded([.18, .70, .18], dark, .06, 3); arm.position.set(side * .38, 1.83, -.30); arm.rotation.set(.78, 0, side * .18); rider.add(arm); arms.push(arm);
    const leg = rounded([.22, .86, .24], dark, .07, 3); leg.position.set(side * .28, 1.18, .34); leg.rotation.set(-.58, 0, side * .08); rider.add(leg);
    const gun = rounded([.12, .11, .56], pale, .025, 3); gun.position.set(side * .46, 1.66, -.78); gun.rotation.x = .18; rider.add(gun);
  }
  rider.userData.arms = arms;
  rider.visible = false; root.add(rider); root.userData.rider = rider;

  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffe5b6, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const muzzle = new THREE.Mesh(new THREE.OctahedronGeometry(.16, 1), muzzleMat);
  muzzle.position.set(0, 1.72, -1.35); root.add(muzzle); root.userData.muzzle = muzzle;

  root.userData.wheels = wheels;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
  });
  return root;
}

export class RenegadeBike {
  constructor(engine, input, player, mats, weaponSystem = null, spawn = new THREE.Vector3(3, .35, 522)) {
    this.engine = engine;
    this.input = input;
    this.player = player;
    this.weaponSystem = weaponSystem;
    this.root = buildBike(mats);
    this.root.position.copy(spawn);
    this.root.rotation.y = 0;
    engine.scene.add(this.root);

    this.spawn = spawn.clone();
    this.mounted = false;
    this.recalling = false;
    this.heading = 0;
    this.speed = 0;
    this.planarVelocity = new THREE.Vector3();
    this.steerVisual = 0;
    this.driftIntensity = 0;
    this.boostEnergy = 100;
    this.boostActive = false;
    this.wheelie = 0;
    this.airTime = 0;
    this.airPitch = 0;
    this.airRoll = 0;

    this._mountHeld = false;
    this._boostHeld = false;
    this._boostPulse = 0;
    this._fireVisual = 0;
    this._simTime = 0;
    this._safeTimer = 0;
    this._promptTimer = 0;
    this._trailTimer = 0;
    this._lastGroundedPos = spawn.clone();
    this._lastGroundedHeading = 0;
    this._impactTimes = new WeakMap();
    this._trail = this._createTrailPool();

    this.player.vehicleTelemetry = this.getTelemetry();
    bus.emit('bikeSpawned', { position: this.root.position.clone() });
  }

  _createTrailPool() {
    const entries = [];
    for (let i = 0; i < 72; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x746bff : 0xa38cff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.16, .018, 2.25), mat);
      mesh.visible = false;
      mesh.frustumCulled = true;
      this.engine.scene.add(mesh);
      entries.push({ mesh, life: 0 });
    }
    return { entries, cursor: 0 };
  }

  setSpawn(position) {
    if (!position) return;
    this.spawn.copy(position);
    if (!this.mounted) {
      this.root.position.copy(position);
      this.heading = 0;
      this.root.rotation.set(0, 0, 0);
      this._lastGroundedPos.copy(position);
      this._lastGroundedHeading = 0;
    }
  }

  getTelemetry() {
    return {
      speed: this.speed,
      drift: this.driftIntensity,
      boost: this._boostPulse,
      boostActive: this.boostActive,
      energy: this.boostEnergy,
      wheelie: this.wheelie,
      airTime: this.airTime,
      steer: this.steerVisual
    };
  }

  _mountTogglePressed() {
    const held = this.input.isDown('KeyV');
    const pressed = held && !this._mountHeld;
    this._mountHeld = held;
    return pressed;
  }

  _emitProximity() {
    const distance = this.root.position.distanceTo(this.player.position);
    bus.emit('bikeProximity', {
      distance,
      mounted: this.mounted,
      recalling: this.recalling,
      position: this.root.position.clone()
    });
  }

  update(dt) {
    this._simTime += dt;
    this._updateTrail(dt);
    const toggle = this._mountTogglePressed();

    if (!this.mounted) {
      this.root.userData.wake.material.opacity = THREE.MathUtils.damp(this.root.userData.wake.material.opacity, this.recalling ? .20 : 0, 9, dt);
      this.root.userData.spectralLight.intensity = THREE.MathUtils.damp(this.root.userData.spectralLight.intensity, this.recalling ? 2.2 : .15, 8, dt);
      if (this.recalling) this._updateRecall(dt);
      if (toggle) {
        const distance = this.root.position.distanceTo(this.player.position);
        if (distance < 5.8) this.mount();
        else this.recall();
      }
      this._promptTimer -= dt;
      if (this._promptTimer <= 0) { this._promptTimer = .12; this._emitProximity(); }
      return;
    }

    if (toggle) { this.dismount(); return; }
    this._updateBikeCombat();

    const t = this.getTelemetry();
    this.player.vehicleTelemetry = t;
    this.root.position.lerp(this.player.position.clone().add(new THREE.Vector3(0, -.02, 0)), 1 - Math.pow(.0001, dt));
    this.root.rotation.y = this.heading;
    this.root.rotation.x = THREE.MathUtils.damp(this.root.rotation.x, this.wheelie * .28 + this.airPitch, 7.5, dt);
    this.root.rotation.z = THREE.MathUtils.damp(this.root.rotation.z, -this.steerVisual * (.16 + this.driftIntensity * .20) + this.airRoll, 8, dt);

    const speedAbs = Math.abs(this.speed);
    this.root.userData.wake.scale.x = 1 + this.driftIntensity * 1.8;
    this.root.userData.wake.material.opacity = THREE.MathUtils.damp(
      this.root.userData.wake.material.opacity,
      Math.min(.74, speedAbs / 180 + this._boostPulse * .46 + this.driftIntensity * .42),
      10,
      dt
    );
    this.root.userData.spectralLight.intensity = THREE.MathUtils.damp(
      this.root.userData.spectralLight.intensity,
      .35 + this._boostPulse * 5.2 + this.driftIntensity * 2.4,
      10,
      dt
    );
    this.root.userData.muzzle.material.opacity = THREE.MathUtils.damp(this.root.userData.muzzle.material.opacity, this._fireVisual, 24, dt);
    this._fireVisual = THREE.MathUtils.damp(this._fireVisual, 0, 30, dt);

    const wheelSpin = speedAbs * dt * 1.9;
    for (const wheel of this.root.userData.wheels) wheel.rotation.x -= wheelSpin;
    this._boostPulse = THREE.MathUtils.damp(this._boostPulse, this.boostActive ? .68 : 0, 5.5, dt);
    this._promptTimer -= dt;
    if (this._promptTimer <= 0) { this._promptTimer = .12; this._emitProximity(); }
  }

  fixedUpdate(dt) {
    if (!this.mounted) return;

    const axes = this.input.getVehicleAxes();
    const moveAxes = this.input.getMoveAxes();
    const throttle = THREE.MathUtils.clamp(axes.throttle, 0, 1);
    const brake = THREE.MathUtils.clamp(axes.brake, 0, 1);
    const steer = THREE.MathUtils.clamp(axes.steer, -1, 1);
    const drifting = this.input.isDown('KeyQ') && this.planarVelocity.length() > 8;
    const boostHeld = this.input.isDown('Space');
    const tier = GameState.refusalTier;

    const maxSpeed = 49 + tier * 7;
    const reverseSpeed = 15 + tier * 2;
    const boostMax = 78 + tier * 11;
    const acceleration = 27 + tier * 4;
    const speedAbsBefore = this.planarVelocity.length();
    const groundedBefore = this.player.grounded;

    const forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    let longitudinal = this.planarVelocity.dot(forward);

    if (throttle > .02) this.planarVelocity.addScaledVector(forward, acceleration * throttle * dt);
    if (brake > .02) {
      if (longitudinal > 1.5) this.planarVelocity.multiplyScalar(Math.max(0, 1 - dt * (1.6 + brake * 2.2)));
      else this.planarVelocity.addScaledVector(forward, -acceleration * .72 * brake * dt);
    }

    if (throttle < .02 && brake < .02) {
      const drag = drifting ? .16 : .50;
      this.planarVelocity.multiplyScalar(Math.max(0, 1 - drag * dt));
    }

    const speedRatio = Math.min(1, speedAbsBefore / Math.max(1, maxSpeed));
    let steerRate = THREE.MathUtils.lerp(1.72, .72, speedRatio);
    if (drifting) steerRate *= 1.72;
    if (!groundedBefore) steerRate *= .46;
    this.heading -= steer * steerRate * dt * (longitudinal >= 0 ? 1 : -1);

    const newForward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const newRight = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    longitudinal = this.planarVelocity.dot(newForward);
    const lateral = this.planarVelocity.dot(newRight);
    const grip = drifting ? .62 : groundedBefore ? 8.6 : .10;
    const retainedLateral = lateral * Math.exp(-grip * dt);
    this.planarVelocity.copy(newForward).multiplyScalar(longitudinal).addScaledVector(newRight, retainedLateral);

    const driftRatio = Math.abs(lateral) / (Math.abs(longitudinal) + 4);
    const driftTarget = drifting ? THREE.MathUtils.clamp(driftRatio * 1.35 + Math.abs(steer) * .28, .12, 1) : 0;
    this.driftIntensity = THREE.MathUtils.damp(this.driftIntensity, driftTarget, drifting ? 8 : 11, dt);
    this.steerVisual = THREE.MathUtils.damp(this.steerVisual, steer * (drifting ? 1.45 : 1), 10, dt);

    if (boostHeld && !this._boostHeld && this.boostEnergy >= 8) {
      this.boostEnergy = Math.max(0, this.boostEnergy - 10);
      this.planarVelocity.addScaledVector(newForward, 12 + tier * 2.5);
      this._boostPulse = 1;
      this.input.pulseGamepad?.(145, .24, .54);
      bus.emit('bikeBoost', { burst: true });
    }

    this.boostActive = boostHeld && this.boostEnergy > .1;
    if (this.boostActive) {
      this.planarVelocity.addScaledVector(newForward, (32 + tier * 5) * dt);
      this.boostEnergy = Math.max(0, this.boostEnergy - (22 - Math.min(6, tier * 1.5)) * dt);
      this._boostPulse = Math.max(this._boostPulse, .72);
    } else {
      const regen = 13 + this.driftIntensity * 13 + (!groundedBefore ? 5 : 0);
      this.boostEnergy = Math.min(100, this.boostEnergy + regen * dt);
    }
    this._boostHeld = boostHeld;

    const cap = this.boostActive ? boostMax : maxSpeed;
    const planarSpeed = this.planarVelocity.length();
    if (planarSpeed > cap) this.planarVelocity.multiplyScalar(cap / planarSpeed);
    const backSpeed = this.planarVelocity.dot(newForward);
    if (backSpeed < -reverseSpeed) this.planarVelocity.addScaledVector(newForward, -reverseSpeed - backSpeed);

    const wheelieTarget = groundedBefore && throttle > .72 && moveAxes.y > .45 && this.planarVelocity.length() > 14 ? 1 : 0;
    this.wheelie = THREE.MathUtils.damp(this.wheelie, wheelieTarget, wheelieTarget ? 5.5 : 8, dt);

    if (!groundedBefore) {
      this.airTime += dt;
      this.airPitch = THREE.MathUtils.damp(this.airPitch, THREE.MathUtils.clamp(moveAxes.y, -1, 1) * .20, 4.5, dt);
      this.airRoll = THREE.MathUtils.damp(this.airRoll, -steer * .22, 4.5, dt);
    } else {
      this.airPitch = THREE.MathUtils.damp(this.airPitch, 0, 8, dt);
      this.airRoll = THREE.MathUtils.damp(this.airRoll, 0, 8, dt);
    }

    const velocity = this.planarVelocity.clone();
    velocity.y = groundedBefore ? 0 : this.player.velocity.y - 24 * dt;
    this.player.moveByVehicle(velocity, dt);

    if (groundedBefore && !this.player.grounded && this.planarVelocity.length() > 16) {
      this.player.velocity.y = Math.max(this.player.velocity.y, Math.min(15, 3.6 + this.planarVelocity.length() * .11));
      this.airTime = .001;
      bus.emit('bikeAirborne', { speed: this.planarVelocity.length() });
    }

    if (!groundedBefore && this.player.grounded && this.airTime > .16) {
      const clean = Math.abs(this.airPitch) < .16 && Math.abs(this.airRoll) < .17;
      const reward = Math.min(22, 4 + this.airTime * (clean ? 9 : 5));
      this.boostEnergy = Math.min(100, this.boostEnergy + reward);
      bus.emit('bikeLanded', { airTime: this.airTime, clean, reward });
      this.input.pulseGamepad?.(Math.min(190, 70 + this.airTime * 60), .18, clean ? .28 : .42);
      this.airTime = 0;
    }

    this.speed = this.planarVelocity.length() * (this.planarVelocity.dot(newForward) >= 0 ? 1 : -1);
    this._applyImpactDamage();
    this._updateSafePoint(dt);
    this._recoverIfInvalid();

    this.root.position.copy(this.player.position).add(new THREE.Vector3(0, -.02, 0));
    this.root.rotation.y = this.heading;
  }

  _updateBikeCombat() {
    if (!this.weaponSystem) return;
    const wantsFire = this.input.isDown('KeyF') || this.input.mouseButtons?.has?.(0);
    if (!wantsFire) return;
    const corona = this.weaponSystem.weapons?.corona;
    if (!corona) return;
    corona.tryFire();
    this._fireVisual = 1;
    this.root.userData.muzzle.material.opacity = 1;
    this.input.pulseGamepad?.(34, .08, .055);
  }

  _applyImpactDamage() {
    const speedAbs = Math.abs(this.speed);
    if (speedAbs < 10 || !this.weaponSystem) return;
    const enemies = this.weaponSystem.enemyManager?.getEnemies?.() || [];
    const radius = 1.6 + this.driftIntensity * 2.25 + this.wheelie * .35;
    const center = this.player.position;
    for (const enemy of enemies) {
      if (enemy.dead || !enemy.mesh) continue;
      if (enemy.mesh.position.distanceToSquared(center) > radius * radius) continue;
      const last = this._impactTimes.get(enemy) || -999;
      if (this._simTime - last < .42) continue;
      this._impactTimes.set(enemy, this._simTime);
      const damage = 8 + speedAbs * (.44 + this.driftIntensity * .82) + (this.boostActive ? 24 : 0) + this.wheelie * 8;
      const point = enemy.mesh.position.clone();
      enemy.takeDamage(damage, point);
      bus.emit('bikeImpact', {
        point,
        damage,
        speed: speedAbs,
        drift: this.driftIntensity,
        boosted: this.boostActive
      });
      this.input.pulseGamepad?.(80, .20, Math.min(.58, .18 + speedAbs / 160));
    }
  }

  _emitTrailSegment(side, intensity) {
    const entry = this._trail.entries[this._trail.cursor];
    this._trail.cursor = (this._trail.cursor + 1) % this._trail.entries.length;
    const local = new THREE.Vector3(side * (.30 + this.driftIntensity * .17), .08, 1.20);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading).add(this.root.position);
    entry.mesh.position.copy(local);
    entry.mesh.position.y = Math.max(.035, local.y);
    entry.mesh.rotation.set(0, this.heading, 0);
    entry.mesh.scale.set(1 + intensity * 1.4, 1, .75 + Math.min(1.9, Math.abs(this.speed) / 38));
    entry.mesh.material.opacity = .20 + intensity * .54;
    entry.mesh.visible = true;
    entry.life = .75 + intensity * .45;
  }

  _updateTrail(dt) {
    for (const entry of this._trail.entries) {
      if (!entry.mesh.visible) continue;
      entry.life -= dt;
      if (entry.life <= 0) { entry.mesh.visible = false; continue; }
      entry.mesh.material.opacity *= Math.pow(.08, dt);
    }
    if (!this.mounted || (!this.boostActive && this.driftIntensity < .14)) return;
    this._trailTimer -= dt;
    if (this._trailTimer > 0) return;
    this._trailTimer = this.driftIntensity > .35 ? .024 : .045;
    const intensity = Math.max(this.driftIntensity, this.boostActive ? .55 : 0);
    this._emitTrailSegment(-1, intensity);
    this._emitTrailSegment(1, intensity);
    if (this.driftIntensity > .55) bus.emit('bikeDriftVfx', { intensity: this.driftIntensity, position: this.root.position.clone() });
  }

  _updateSafePoint(dt) {
    this._safeTimer -= dt;
    if (this._safeTimer > 0) return;
    this._safeTimer = .12;
    const p = this.player.position;
    if (this.player.grounded && p.y > -2.5 && p.y < 80 && Math.abs(this.player.velocity.y) < 1.2) {
      this._lastGroundedPos.copy(p);
      this._lastGroundedHeading = this.heading;
    }
  }

  _recoverIfInvalid() {
    const p = this.player.position;
    const outside = Math.abs(p.x) > 1380 || p.z > 2250 || p.z < -5350;
    if (p.y > -18 && !outside) return;
    const safe = this._lastGroundedPos.y > -3 ? this._lastGroundedPos : this.spawn;
    this.heading = this._lastGroundedHeading;
    this.planarVelocity.set(0, 0, 0);
    this.speed = 0;
    this.player.teleport(safe.clone().add(new THREE.Vector3(0, 1.35, 0)));
    this.root.position.copy(this.player.position);
    this.root.rotation.set(0, this.heading, 0);
    this.boostEnergy = Math.max(this.boostEnergy, 35);
    bus.emit('bikeRecovered', { position: safe.clone() });
  }

  recall() {
    if (this.mounted) return;
    this.recalling = true;
    bus.emit('bikeRecall', { from: this.root.position.clone(), to: this.player.position.clone() });
    this.input.pulseGamepad?.(85, .12, .18);
  }

  _updateRecall(dt) {
    const target = this.player.position.clone();
    const to = target.sub(this.root.position);
    const dist = to.length();
    if (dist < 4.6) {
      this.recalling = false;
      this.root.position.y = Math.max(this.root.position.y, this.player.position.y - .1);
      bus.emit('bikeRecallArrived');
      return;
    }
    to.normalize();
    const speed = THREE.MathUtils.clamp(dist * 2.2, 28, 88);
    this.root.position.addScaledVector(to, speed * dt);
    this.heading = Math.atan2(-to.x, -to.z);
    this.root.rotation.y = this.heading;
  }

  mount() {
    if (this.mounted) return;
    this.recalling = false;
    this.weaponSystem?.switchTo?.('corona');
    this.mounted = true;
    this.root.userData.rider.visible = true;
    const carry = this.player.velocity.clone(); carry.y = 0;
    this.planarVelocity.copy(carry).multiplyScalar(.72);
    this.player.setVehicleMounted(true);
    this.player.teleport(this.root.position.clone().add(new THREE.Vector3(0, .4, 0)));
    this.player.yaw = this.heading;
    this.player.pitch = -.08;
    this.speed = this.planarVelocity.length();
    this._lastGroundedPos.copy(this.root.position);
    this._lastGroundedHeading = this.heading;
    bus.emit('bikeMounted');
    this.input.pulseGamepad?.(80, .12, .18);
  }

  dismount() {
    if (!this.mounted) return;
    const launchSpeed = Math.abs(this.speed);
    const carry = this.planarVelocity.clone();
    this.mounted = false;
    this.boostActive = false;
    this.root.userData.rider.visible = false;
    this.player.setVehicleMounted(false);
    const side = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const launch = launchSpeed > 18;
    const pos = this.player.position.clone()
      .addScaledVector(side, launch ? 1.1 : 1.7)
      .addScaledVector(forward, launch ? 1.25 : 0)
      .add(new THREE.Vector3(0, launch ? .9 : .3, 0));
    this.player.teleport(pos);
    this.player.yaw = this.heading;
    if (launch) {
      this.player.velocity.copy(carry).multiplyScalar(.56);
      this.player.velocity.y = Math.min(8.5, 3.8 + launchSpeed * .045);
      this.player.grounded = false;
      bus.emit('bikeLaunchDismount', { speed: launchSpeed });
    }
    this.planarVelocity.set(0, 0, 0);
    this.speed = 0;
    bus.emit('bikeDismounted');
  }
}
