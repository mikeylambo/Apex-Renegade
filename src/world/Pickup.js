import * as THREE from 'three/webgpu';
import { GameState, bus } from '../core/GameState.js';

const GEO = {
  health: new THREE.OctahedronGeometry(0.35, 0),
  ammo: new THREE.BoxGeometry(0.4, 0.4, 0.6)
};
const MAT = {
  health: new THREE.MeshStandardMaterial({ color: 0xd4145a, emissive: 0xff2d6e, emissiveIntensity: 1.1 }),
  ammo: new THREE.MeshStandardMaterial({ color: 0x7c1fd6, emissive: 0xb24bff, emissiveIntensity: 1.0 })
};

export class Pickup {
  constructor(engine, type, position, amount = type === 'health' ? 25 : 30) {
    this.type = type;
    this.amount = amount;
    this.collected = false;
    this.mesh = new THREE.Mesh(GEO[type], MAT[type]);
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.9;
    this.mesh.castShadow = true;
    engine.scene.add(this.mesh);
    this.engine = engine;
    this._t = Math.random() * 10;
  }

  update(dt, playerPos) {
    if (this.collected) return;
    this._t += dt;
    this.mesh.rotation.y = this._t * 1.4;
    this.mesh.position.y = 0.9 + Math.sin(this._t * 2) * 0.08;
    if (this.mesh.position.distanceTo(playerPos) < 1.2) {
      this.collected = true;
      if (this.type === 'health') GameState.healPlayer(this.amount);
      bus.emit('pickup', { type: this.type, amount: this.amount });
      this.engine.scene.remove(this.mesh);
    }
  }
}
