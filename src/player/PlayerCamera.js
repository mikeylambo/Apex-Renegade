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
  }

  addRecoil(pitchKick, yawKick) {
    this.recoilVelocity.x += pitchKick;
    this.recoilVelocity.y += yawKick * (Math.random() > 0.5 ? 1 : -1);
  }

  setFovPunch(fov) { this.targetFov = fov; }

  update(dt) {
    const c = this.controller;
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
    this.recoilVelocity.multiplyScalar(0.001 ** dt);
    this.recoil.addScaledVector(this.recoilVelocity, dt);
    this.recoil.multiplyScalar(Math.pow(0.0001, dt));
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = c.yaw + this.recoil.y;
    this.camera.rotation.x = c.pitch + this.recoil.x;
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, tilt, 8, dt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.targetFov, 10, dt);
    this.camera.updateProjectionMatrix();
    this.targetFov = THREE.MathUtils.damp(this.targetFov, this.baseFov, 3, dt);
  }
}
