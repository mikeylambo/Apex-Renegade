import * as THREE from 'three/webgpu';
import { bus } from '../core/GameState.js';

const POOL_SIZE = 180;

/**
 * Pooled sprite particles — no per-shot allocation. Each active particle
 * carries velocity + life in parallel arrays; dead ones are recycled.
 */
export class Particles {
  constructor(engine, camera) {
    this.engine = engine;
    this.camera = camera;

    const tex = this._makeGlowTexture();
    this.material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

    this.sprites = [];
    this.velocities = [];
    this.lives = [];
    this.maxLives = [];
    this.colors = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = new THREE.Sprite(this.material.clone());
      sprite.visible = false;
      sprite.scale.set(0.001, 0.001, 0.001);
      engine.scene.add(sprite);
      this.sprites.push(sprite);
      this.velocities.push(new THREE.Vector3());
      this.lives.push(0);
      this.maxLives.push(1);
    }
    this._cursor = 0;

    bus.on('enemyHit', ({ hitPoint }) => this.burst(hitPoint, 0xc6dcf0, 6, 2.7));
    bus.on('enemyDied', ({ position }) => this.burst(position.clone().setY(1), 0x8175e8, 16, 3.7));
    bus.on('worldHit', ({ point }) => this.burst(point, 0xe2edf7, 5, 3.4));
    bus.on('powerImpact', ({ point, tier }) => this.burst(point, tier >= 4 ? 0xb9adff : 0x8e83f2, 9 + tier * 5, 4.0 + tier * .85));
    bus.on('meleeSwing', ({ hit }) => { if (hit) this.burst(this.camera.getWorldPosition(new THREE.Vector3()), 0xe0ae67, 7, 3.1); });
    bus.on('ruptureSealed', ({ position }) => this.burst(position.clone().setY(1.2), 0x8e83f2, 24, 4.7));
  }

  _makeGlowTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  burst(position, color, count, speed) {
    if (!position) return;
    for (let i = 0; i < count; i++) {
      const idx = this._cursor;
      this._cursor = (this._cursor + 1) % POOL_SIZE;
      const sprite = this.sprites[idx];
      sprite.visible = true;
      sprite.position.copy(position);
      sprite.material.color.setHex(color);
      sprite.material.opacity = 1;
      sprite.scale.setScalar(0.25 + Math.random() * 0.2);
      const dir = new THREE.Vector3(
        (Math.random() - 0.5), Math.random() * 0.6 + 0.2, (Math.random() - 0.5)
      ).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.velocities[idx].copy(dir);
      this.lives[idx] = 0.001;
      this.maxLives[idx] = 0.35 + Math.random() * 0.25;
    }
  }

  update(dt) {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (!this.sprites[i].visible) continue;
      this.lives[i] += dt;
      const t = this.lives[i] / this.maxLives[i];
      if (t >= 1) { this.sprites[i].visible = false; continue; }
      const sprite = this.sprites[i];
      sprite.position.addScaledVector(this.velocities[i], dt);
      this.velocities[i].y -= 6 * dt;
      sprite.material.opacity = 1 - t;
    }
  }
}
