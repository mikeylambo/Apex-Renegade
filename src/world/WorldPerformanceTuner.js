export class WorldPerformanceTuner {
  constructor(engine, player) {
    this.engine = engine;
    this.player = player;
    this.entries = [];
    this.timer = 0;
    this.captured = false;
  }

  capture() {
    this.entries.length = 0;
    this.engine.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!Object.prototype.hasOwnProperty.call(o.userData || {}, 'worldSurface')) return;
      o.geometry?.computeBoundingSphere?.();
      const radius = o.geometry?.boundingSphere?.radius ?? 1;
      this.entries.push({
        mesh: o,
        radius,
        baseVisible: o.visible !== false,
        baseCastShadow: !!o.castShadow,
        baseReceiveShadow: !!o.receiveShadow
      });
    });
    this.captured = true;
    this._apply();
  }

  update(dt) {
    if (!this.captured) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = .28;
    this._apply();
  }

  _apply() {
    const p = this.player.position;
    for (const entry of this.entries) {
      const { mesh, radius } = entry;
      if (!mesh.parent) continue;
      const dx = mesh.getWorldPosition(_world).x - p.x;
      const dz = _world.z - p.z;
      const d2 = dx * dx + dz * dz;

      let visible = entry.baseVisible;
      if (radius < 1.25 && d2 > 230 * 230) visible = false;
      else if (radius < 3.5 && d2 > 420 * 420) visible = false;
      else if (radius < 9 && d2 > 820 * 820) visible = false;
      else if (radius < 22 && d2 > 1550 * 1550) visible = false;

      mesh.visible = visible;
      if (!visible) continue;

      // Most frame spikes in the first Vertical Megacity pass come from tiny
      // facade pieces joining the shadow pass. Keep nearby architecture rich,
      // but let distant city mass read as silhouette rather than thousands of
      // shadow-casting submeshes.
      mesh.castShadow = entry.baseCastShadow && d2 < 330 * 330;
      mesh.receiveShadow = entry.baseReceiveShadow && d2 < 950 * 950;
    }
  }
}

import * as THREE from 'three/webgpu';
const _world = new THREE.Vector3();
