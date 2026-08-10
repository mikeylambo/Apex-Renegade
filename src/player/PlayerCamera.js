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
  }

  addRecoil(pitchKick, yawKick) {
    this.recoilVelocity.x += pitchKick;
    this.recoilVelocity.y += yawKick * (Math.random() > 0.5 ? 1 : -1);
  }

  setFovPunch(fov) { this.targetFov = fov; }

  update(dt) {
    const c = this.controller;
    this.recoilVelocity.multiplyScalar(0.001 ** dt);
    this.recoil.addScaledVector(this.recoilVelocity, dt);
    this.recoil.multiplyScalar(Math.pow(0.0001, dt));

    if (c.vehicleMounted) {
      this._updateVehicleCamera(dt);
      return;
    }

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
    const forward = c.forward;
    const right = c.right;
    const speed = Math.hypot(c.velocity.x, c.velocity.z);

    const desired = pos.clone()
      .addScaledVector(forward, -6.5)
      .addScaledVector(right, .18)
      .add(new THREE.Vector3(0, 3.15, 0));

    if (this._vehicleCameraPos.lengthSq() < .01) this._vehicleCameraPos.copy(desired);
    this._vehicleCameraPos.lerp(desired, 1 - Math.pow(.00003, dt));
    this.camera.position.copy(this._vehicleCameraPos);

    const target = pos.clone()
      .addScaledVector(forward, 9.5)
      .add(new THREE.Vector3(0, 1.15 - c.pitch * 5.2, 0));
    this.camera.lookAt(target);
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, 0, 9, dt);

    const speedFov = THREE.MathUtils.clamp((speed - 12) / 60, 0, 1);
    const desiredFov = 86 + speedFov * 17;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 6, dt);
    this.camera.updateProjectionMatrix();
    this.targetFov = this.baseFov;
  }
}
