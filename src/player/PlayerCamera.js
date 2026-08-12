import * as THREE from 'three/webgpu';

export class PlayerCamera {
  constructor(camera, controller) {
    this.camera = camera;
    this.controller = controller;
    this.bobTime = 0;
    this.recoil = new THREE.Vector2(0, 0);
    this.recoilVelocity = new THREE.Vector2(0, 0);
    this.baseFov = 92;
    this.targetFov = this.baseFov;
    this._vehicleCameraPos = new THREE.Vector3();
    this._vehicleOrbitYaw = 0;
    this._vehicleOrbitPitch = .03;
    this._vehicleLookIdle = 0;
    this._vehicleWasMounted = false;
  }

  addRecoil(pitchKick, yawKick) {
    this.recoilVelocity.x += pitchKick;
    this.recoilVelocity.y += yawKick * (Math.random() > 0.5 ? 1 : -1);
  }

  setFovPunch(fov) { this.targetFov = fov; }

  updateVehicleLook(delta, dt) {
    const active = Math.abs(delta.x) + Math.abs(delta.y) > .02;
    if (active) {
      this._vehicleLookIdle = 0;
      this._vehicleOrbitYaw -= delta.x * .00215;
      this._vehicleOrbitPitch -= delta.y * .00165;
      this._vehicleOrbitPitch = THREE.MathUtils.clamp(this._vehicleOrbitPitch, -.30, .56);
    } else {
      this._vehicleLookIdle += dt;
      // Keep deliberate camera choices for a moment, then softly return behind
      // the bike. Fast travel still feels directed without fighting the right stick.
      if (this._vehicleLookIdle > 1.45) {
        const recenter = this._vehicleLookIdle > 3.2 ? 1.55 : .72;
        this._vehicleOrbitYaw = THREE.MathUtils.damp(this._vehicleOrbitYaw, 0, recenter, dt);
        this._vehicleOrbitPitch = THREE.MathUtils.damp(this._vehicleOrbitPitch, .03, recenter * .72, dt);
      }
    }
  }

  update(dt) {
    const c = this.controller;
    this.recoilVelocity.multiplyScalar(0.001 ** dt);
    this.recoil.addScaledVector(this.recoilVelocity, dt);
    this.recoil.multiplyScalar(Math.pow(0.0001, dt));

    if (c.vehicleMounted) {
      if (!this._vehicleWasMounted) {
        this._vehicleCameraPos.set(0, 0, 0);
        this._vehicleOrbitYaw = 0;
        this._vehicleOrbitPitch = .03;
        this._vehicleLookIdle = 0;
      }
      this._vehicleWasMounted = true;
      this._updateVehicleCamera(dt);
      return;
    }
    this._vehicleWasMounted = false;

    const eye = c.getEyePosition();
    const speed = Math.hypot(c.velocity.x, c.velocity.z);
    const grounded = c.grounded && !c.sliding;
    if (grounded && speed > 0.5) this.bobTime += dt * (speed / 6.2) * 10;
    const bobY = grounded ? Math.sin(this.bobTime) * 0.035 * Math.min(speed / 6.2, 1.4) : 0;
    const bobX = grounded ? Math.cos(this.bobTime * 0.5) * 0.02 * Math.min(speed / 6.2, 1.4) : 0;

    let tilt = 0;
    if (c.sliding) tilt = -0.09;
    if (c.onWall) tilt = c.wallNormal ? -Math.sign(c.wallNormal.dot(c.right)) * 0.12 : 0;

    this.camera.position.set(eye.x + bobX, eye.y + bobY, eye.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = c.yaw + this.recoil.y;
    this.camera.rotation.x = c.pitch + this.recoil.x;
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, tilt, 8, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.targetFov, 10, dt);
    this.camera.updateProjectionMatrix();
    this.targetFov = THREE.MathUtils.damp(this.targetFov, this.baseFov, 3, dt);
  }

  _updateVehicleCamera(dt) {
    const c = this.controller;
    const pos = c.position;
    const bikeForward = c.forward;
    const telemetry = c.vehicleTelemetry || {};
    const speed = Math.abs(Number(telemetry.speed)) || Math.hypot(c.velocity.x, c.velocity.z);
    const speed01 = THREE.MathUtils.clamp(speed / 82, 0, 1);
    const drift = THREE.MathUtils.clamp(Number(telemetry.drift) || 0, 0, 1);
    const boost = THREE.MathUtils.clamp(Number(telemetry.boost) || 0, 0, 1);
    const steer = THREE.MathUtils.clamp(Number(telemetry.steer) || 0, -1.5, 1.5);
    const air = Math.min(1, (Number(telemetry.airTime) || 0) / 1.2);
    const wheelie = THREE.MathUtils.clamp(Number(telemetry.wheelie) || 0, 0, 1);

    const viewYaw = c.yaw + this._vehicleOrbitYaw;
    const orbitForward = new THREE.Vector3(-Math.sin(viewYaw), 0, -Math.cos(viewYaw));
    const orbitRight = new THREE.Vector3(Math.cos(viewYaw), 0, -Math.sin(viewYaw));

    const backDistance = 7.0 + speed01 * 4.6 + boost * 1.65 + wheelie * 1.65;
    const driftSide = -drift * steer * 1.05;
    const pitchLift = Math.sin(this._vehicleOrbitPitch) * backDistance * .82;
    const height = 3.15 + speed01 * .42 + air * .72 + wheelie * .52 + pitchLift;

    const desired = pos.clone()
      .addScaledVector(orbitForward, -backDistance)
      .addScaledVector(orbitRight, driftSide)
      .add(new THREE.Vector3(0, height, 0));

    if (this._vehicleCameraPos.lengthSq() < .01) this._vehicleCameraPos.copy(desired);
    const follow = boost > .2 ? .00048 : drift > .25 ? .0010 : wheelie > .15 ? .00052 : .000025;
    this._vehicleCameraPos.lerp(desired, 1 - Math.pow(follow, dt));
    this.camera.position.copy(this._vehicleCameraPos);

    // Look slightly ahead along the actual bike heading. The camera can orbit all
    // the way around the motorcycle without changing steering or rider heading.
    const target = pos.clone()
      .addScaledVector(bikeForward, 4.5 + speed01 * 5.5)
      .add(new THREE.Vector3(0, 1.18 + air * .34 + wheelie * .26, 0));
    this.camera.lookAt(target);
    this.camera.rotation.z += -drift * steer * .040;

    const desiredFov = 84 + speed01 * 18 + boost * 8.5 - wheelie * 1.5;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, boost > .2 ? 8.5 : 6.5, dt);
    this.camera.updateProjectionMatrix();
    this.targetFov = this.baseFov;
  }
}
