import * as THREE from 'three/webgpu';

const _world = new THREE.Vector3();

export class WorldPerformanceTuner {
  constructor(engine, player) {
    this.engine = engine;
    this.player = player;
    this.entries = [];
    this.timer = 0;
    this.captured = false;
    this.motionMode = false;
  }

  capture() {
    this.entries.length = 0;
    this.engine.scene.updateMatrixWorld(true);
    this.engine.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!Object.prototype.hasOwnProperty.call(o.userData || {}, 'worldSurface')) return;
      o.geometry?.computeBoundingSphere?.();
      const radius = o.geometry?.boundingSphere?.radius ?? 1;
      o.getWorldPosition(_world);
      this.entries.push({
        mesh: o,
        x: _world.x,
        z: _world.z,
        radius,
        baseVisible: o.visible !== false,
        baseCastShadow: !!o.castShadow,
        baseReceiveShadow: !!o.receiveShadow
      });
    });
    this.captured = true;
    this._apply();
  }

  setMotionMode(active) {
    const next = !!active;
    if (next === this.motionMode) return;
    this.motionMode = next;
    this.timer = 0;
    this._apply();
  }

  update(dt) {
    if (!this.captured) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.motionMode ? .46 : .34;
    this._apply();
  }

  _apply() {
    const p = this.player.position;
    const motion = this.motionMode;
    for (const entry of this.entries) {
      const { mesh, radius, x, z } = entry;
      if (!mesh.parent) continue;
      const dx = x - p.x;
      const dz = z - p.z;
      const d2 = dx * dx + dz * dz;

      let visible = entry.baseVisible;
      if (motion) {
        // High-speed traversal prioritizes silhouette, road and large structural
        // reads. Tiny dressing is not useful at 70+ m/s and becomes pure cost.
        if (radius < 1.25 && d2 > 125 * 125) visible = false;
        else if (radius < 3.5 && d2 > 260 * 260) visible = false;
        else if (radius < 9 && d2 > 560 * 560) visible = false;
        else if (radius < 22 && d2 > 1050 * 1050) visible = false;
      } else {
        if (radius < 1.25 && d2 > 210 * 210) visible = false;
        else if (radius < 3.5 && d2 > 390 * 390) visible = false;
        else if (radius < 9 && d2 > 760 * 760) visible = false;
        else if (radius < 22 && d2 > 1450 * 1450) visible = false;
      }

      mesh.visible = visible;
      if (!visible) continue;

      mesh.castShadow = entry.baseCastShadow && d2 < (motion ? 170 * 170 : 300 * 300);
      mesh.receiveShadow = entry.baseReceiveShadow && d2 < (motion ? 620 * 620 : 880 * 880);
    }
  }
}
