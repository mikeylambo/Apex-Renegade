import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bus, GameState } from '../core/GameState.js';

function rounded(size, mat, radius = .08, segments = 3) {
  const maxR = Math.min(...size.map((v) => v * .18));
  return new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segments, Math.min(radius, maxR)), mat);
}

function buildBike(mats) {
  const root = new THREE.Group();
  const dark = mats.blackMetal;
  const steel = mats.metal;
  const pale = mats.paleMetal;
  const comp = mats.composite;
  const glow = mats.spectral;

  const body = rounded([1.05, .58, 2.55], dark, .15, 4);
  body.position.y = .76;
  root.add(body);

  const spine = rounded([.46, .32, 2.85], steel, .10, 4);
  spine.position.set(0, 1.02, -.08);
  spine.rotation.x = -.035;
  root.add(spine);

  const saddle = rounded([.62, .18, .76], comp, .08, 3);
  saddle.position.set(0, 1.24, .36);
  saddle.rotation.x = -.08;
  root.add(saddle);

  const nose = rounded([.72, .45, .78], pale, .12, 4);
  nose.position.set(0, .93, -1.42);
  nose.rotation.x = -.08;
  root.add(nose);

  const tail = rounded([.78, .34, .72], dark, .12, 4);
  tail.position.set(0, .88, 1.45);
  root.add(tail);

  for (const side of [-1, 1]) {
    const flank = rounded([.18, .34, 1.82], comp, .06, 3);
    flank.position.set(side * .53, .80, .08);
    flank.rotation.z = side * .055;
    root.add(flank);

    const conduit = rounded([.045, .06, 1.58], glow, .016, 2);
    conduit.position.set(side * .645, .94, -.02);
    root.add(conduit);

    const bar = rounded([.48, .06, .08], pale, .025, 2);
    bar.position.set(side * .34, 1.38, -1.18);
    bar.rotation.z = side * .15;
    root.add(bar);
  }

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: .78, metalness: .18 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x7f8b98, roughness: .28, metalness: .91 });
  for (const z of [-1.28, 1.22]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.53, .14, 10, 28), wheelMat);
    wheel.position.set(0, .52, z);
    wheel.rotation.y = Math.PI / 2;
    root.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .84, 14), hubMat);
    hub.position.set(0, .52, z);
    hub.rotation.z = Math.PI / 2;
    root.add(hub);
  }

  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(.72, 3.4),
    new THREE.MeshBasicMaterial({ color: 0x7066ef, transparent: true, opacity: .0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, .08, 1.95);
  root.add(wake);
  root.userData.wake = wake;

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
  });

  return root;
}

export class RenegadeBike {
  constructor(engine, input, player, mats, spawn = new THREE.Vector3(7, 0, 505)) {
    this.engine = engine;
    this.input = input;
    this.player = player;
    this.root = buildBike(mats);
    this.root.position.copy(spawn);
    this.root.rotation.y = Math.PI;
    engine.scene.add(this.root);

    this.spawn = spawn.clone();
    this.mounted = false;
    this.speed = 0;
    this.heading = Math.PI;
    this.steerVisual = 0;
    this._mountHeld = false;
    this._boostHeld = false;
    this._boostPulse = 0;
    this._lastGroundedPos = spawn.clone();

    bus.emit('bikeSpawned', { position: this.root.position.clone() });
  }

  setSpawn(position) {
    if (!position) return;
    this.spawn.copy(position);
    if (!this.mounted) {
      this.root.position.copy(position);
      this.heading = Math.PI;
      this.root.rotation.y = this.heading;
    }
  }

  _mountTogglePressed() {
    const held = this.input.isDown('KeyV');
    const pressed = held && !this._mountHeld;
    this._mountHeld = held;
    return pressed;
  }

  update(dt) {
    const toggle = this._mountTogglePressed();
    if (!this.mounted) {
      this.root.userData.wake.material.opacity = THREE.MathUtils.damp(this.root.userData.wake.material.opacity, 0, 9, dt);
      if (toggle && this.root.position.distanceTo(this.player.position) < 5.2) this.mount();
      return;
    }

    if (toggle) this.dismount();
    this.root.position.lerp(this.player.position.clone().add(new THREE.Vector3(0, -.02, 0)), 1 - Math.pow(.0001, dt));
    this.root.rotation.y = this.heading;
    this.root.rotation.z = THREE.MathUtils.damp(this.root.rotation.z, -this.steerVisual * .20, 8, dt);
    this.root.userData.wake.material.opacity = THREE.MathUtils.damp(
      this.root.userData.wake.material.opacity,
      Math.min(.28, Math.abs(this.speed) / 170 + this._boostPulse * .18),
      8,
      dt
    );
    this._boostPulse = THREE.MathUtils.damp(this._boostPulse, 0, 6, dt);
  }

  fixedUpdate(dt) {
    if (!this.mounted) return;

    const axes = this.input.getVehicleAxes();
    const throttle = THREE.MathUtils.clamp(axes.throttle, 0, 1);
    const brake = THREE.MathUtils.clamp(axes.brake, 0, 1);
    const steer = THREE.MathUtils.clamp(axes.steer, -1, 1);
    const drifting = this.input.isDown('KeyQ');
    const boostHeld = this.input.isDown('Space');

    const tier = GameState.refusalTier;
    const maxSpeed = 50 + tier * 7;
    const reverseSpeed = 15 + tier * 2;
    const acceleration = 28 + tier * 4;
    const boostMax = 72 + tier * 10;

    if (throttle > .02) this.speed += acceleration * throttle * dt;
    if (brake > .02) this.speed -= acceleration * 1.45 * brake * dt;

    if (throttle < .02 && brake < .02) {
      const drag = Math.max(0, 1 - dt * (drifting ? .42 : .78));
      this.speed *= drag;
    }

    if (boostHeld && !this._boostHeld && Math.abs(this.speed) > 5) {
      this._boostPulse = 1;
      this.speed += Math.sign(this.speed || 1) * (11 + tier * 2.5);
      this.input.pulseGamepad?.(110, .18, .38);
      bus.emit('bikeBoost');
    }
    this._boostHeld = boostHeld;

    const cap = boostHeld ? boostMax : maxSpeed;
    this.speed = THREE.MathUtils.clamp(this.speed, -reverseSpeed, cap);

    const speedRatio = Math.min(1, Math.abs(this.speed) / Math.max(1, maxSpeed));
    const steerRate = THREE.MathUtils.lerp(1.75, .72, speedRatio);
    const driftMult = drifting ? 1.75 : 1;
    this.heading -= steer * steerRate * driftMult * dt * (this.speed >= 0 ? 1 : -1);
    this.steerVisual = THREE.MathUtils.damp(this.steerVisual, steer * (drifting ? 1.45 : 1), 10, dt);

    const forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const velocity = forward.multiplyScalar(this.speed);
    velocity.y = this.player.velocity.y;
    if (!this.player.grounded) velocity.y -= 24 * dt;
    else velocity.y = 0;

    const before = this.player.position;
    this.player.moveByVehicle(velocity, dt);
    const after = this.player.position;
    if (after.y > -4) this._lastGroundedPos.copy(after);

    // If the rider somehow falls through an unmodeled void, recover to the last
    // sensible location instead of losing the playtest session.
    if (after.y < -35) {
      this.player.teleport(this._lastGroundedPos.clone().add(new THREE.Vector3(0, 2, 0)));
      this.speed = 0;
    }

    this.root.position.copy(this.player.position).add(new THREE.Vector3(0, -.02, 0));
    this.root.rotation.y = this.heading;
  }

  mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.player.setVehicleMounted(true);
    this.player.teleport(this.root.position.clone().add(new THREE.Vector3(0, .4, 0)));
    this.player.yaw = this.heading;
    this.player.pitch = -.08;
    this.speed = 0;
    bus.emit('bikeMounted');
    this.input.pulseGamepad?.(80, .12, .18);
  }

  dismount() {
    if (!this.mounted) return;
    this.mounted = false;
    this.player.setVehicleMounted(false);
    const side = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const pos = this.player.position.clone().addScaledVector(side, 1.7).add(new THREE.Vector3(0, .3, 0));
    this.player.teleport(pos);
    this.player.yaw = this.heading;
    this.speed = 0;
    bus.emit('bikeDismounted');
  }
}
