import * as THREE from 'three/webgpu';
import { bus } from '../core/GameState.js';

export class TearRupture {
  constructor(engine, position, archetypeIds, spawnFn) {
    this.engine = engine;
    this.position = position.clone();
    this.archetypeIds = archetypeIds.length ? archetypeIds : ['hollow'];
    this.spawnFn = spawnFn;
    this.health = 220;
    this.maxHealth = 220;
    this.dead = false;
    this.spawnInterval = 2.2;
    this.spawnTimer = 1.2;
    this.maxLiveSpawns = 3;
    this.liveSpawnCount = 0;
    this.mesh = this._buildMesh();
    this.mesh.position.copy(this.position);
    this.mesh.userData.damageable = this;
    this.mesh.traverse((c) => { if (c.isMesh) c.userData.damageable = this; });
    engine.scene.add(this.mesh);
    this._clock = 0;
  }

  _buildMesh() {
    const group = new THREE.Group();
    const dark=new THREE.MeshStandardMaterial({color:0x090d14,roughness:.34,metalness:.78});
    const steel=new THREE.MeshStandardMaterial({color:0x7f8b99,roughness:.24,metalness:.91});
    const spectral=new THREE.MeshStandardMaterial({color:0x11172a,emissive:0x756cff,emissiveIntensity:1.15,roughness:.20,metalness:.48});
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 2), spectral);
    core.position.y = 1.25; core.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 10, 40), dark);
    ring.position.y = 1.25; ring.rotation.x = Math.PI / 2;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.78, 0.035, 8, 36), steel);
    ring2.position.y=1.25; ring2.rotation.set(Math.PI/2,.28,.18);

    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;
      const claw=new THREE.Mesh(new THREE.BoxGeometry(.14,.92,.20),i%2?steel:dark);
      claw.position.set(Math.cos(a)*.92,.72,Math.sin(a)*.92);claw.rotation.y=-a;claw.rotation.z=(i%2?-.18:.18);claw.castShadow=true;group.add(claw);
      const tip=new THREE.Mesh(new THREE.OctahedronGeometry(.11,0),spectral);tip.position.set(Math.cos(a)*.82,1.17,Math.sin(a)*.82);tip.scale.set(.55,1.9,.55);group.add(tip);
    }
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.42,.20,12),dark);base.position.y=.10;base.castShadow=true;base.receiveShadow=true;group.add(base);
    const collar=new THREE.Mesh(new THREE.TorusGeometry(1.15,.05,8,36),steel);collar.rotation.x=Math.PI/2;collar.position.y=.23;group.add(collar);
    const light=new THREE.PointLight(0x756cff,2.2,6.5,2);light.position.y=1.25;group.add(light);
    group.add(core, ring, ring2);
    group.userData.core = core;
    group.userData.ring = ring;
    group.userData.ring2 = ring2;
    group.userData.light = light;
    return group;
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.engine.scene.remove(this.mesh);
      bus.emit('ruptureSealed', { position: this.position.clone() });
    }
  }

  notifySpawnDied() { this.liveSpawnCount = Math.max(0, this.liveSpawnCount - 1); }

  update(dt) {
    if (this.dead) return;
    this._clock += dt;
    const pulse = 1 + Math.sin(this._clock * 3) * 0.08;
    this.mesh.userData.core.scale.setScalar(pulse);
    this.mesh.userData.ring.rotation.z += dt * 1.15;
    this.mesh.userData.ring2.rotation.z -= dt * 1.65;
    this.mesh.userData.ring2.rotation.y += dt * .42;
    this.mesh.userData.light.intensity = 1.75 + Math.sin(this._clock * 4.1) * .55;
    if (this.liveSpawnCount >= this.maxLiveSpawns) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      const type = this.archetypeIds[Math.floor(Math.random() * this.archetypeIds.length)];
      this.spawnFn(type, this.position);
      this.liveSpawnCount += 1;
    }
  }

  getHitObjects() {
    if (this.dead) return [];
    return [this.mesh.userData.core, this.mesh.userData.ring];
  }
}
