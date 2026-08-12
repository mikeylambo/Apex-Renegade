import * as THREE from 'three/webgpu';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function softTexture(inner, mid) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(.42, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function ridgeGeometry(width, depth, segments, seed) {
  const rng = seeded(seed);
  const verts = [];
  const inds = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = (t - .5) * width;
    const h = 55 + Math.sin(t * Math.PI * 5.2) * 26 + Math.sin(t * Math.PI * 11.7) * 11 + rng() * 38;
    const z = (rng() - .5) * depth;
    verts.push(x, -18, z, x, h, z);
    if (i < segments) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      inds.push(a, c, b, c, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(inds); geo.computeVertexNormals(); return geo;
}

export class VisualCeilingWorldIV {
  constructor(engine) {
    this.engine = engine;
    this.root = new THREE.Group();
    this.root.name = 'Visual Ceiling IV // optimized horizon architecture';
    this.scar = new THREE.Group();
    this.expanse = new THREE.Group();
    this.vertical = new THREE.Group();
    this.root.add(this.scar, this.expanse, this.vertical);
    engine.scene.add(this.root);
    this.time = 0;
    this.transit = null;
    this.transitData = [];
    this.built = false;
  }

  build() {
    if (this.built) return;
    this.built = true;
    this._buildScarFrame();
    this._buildExpanseHorizon();
    this._buildVerticalParallax();
    this._buildRegionalVeils();
    this.engine.onUpdate?.((dt) => this.update(dt));
  }

  _buildScarFrame() {
    // One instanced draw gives the Scar a denser industrial skyline without
    // hundreds of unique facade objects.
    const rng = seeded(0x51CA4);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: .73, metalness: .42 });
    const mass = new THREE.InstancedMesh(geo, mat, 28);
    const d = new THREE.Object3D();
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? -1 : 1;
      const h = 70 + rng() * 210, w = 22 + rng() * 58, dep = 25 + rng() * 70;
      d.position.set(side * (210 + rng() * 310), h * .5, 520 - rng() * 1250);
      d.scale.set(w, h, dep); d.rotation.y = (rng() - .5) * .15; d.updateMatrix(); mass.setMatrixAt(i, d.matrix);
    }
    mass.castShadow = false; mass.receiveShadow = false; mass.userData.worldSurface = false;
    this.scar.add(mass);
  }

  _buildExpanseHorizon() {
    const ridgeMatFar = new THREE.MeshStandardMaterial({ color: 0x0b1116, roughness: 1, metalness: 0 });
    const ridgeMatNear = new THREE.MeshStandardMaterial({ color: 0x182126, roughness: .98, metalness: 0 });
    const far = new THREE.Mesh(ridgeGeometry(3300, 380, 52, 0xEAA401), ridgeMatFar);
    far.position.set(0, -8, -3150); far.scale.y = 3.0; far.userData.worldSurface = false; this.expanse.add(far);
    const near = new THREE.Mesh(ridgeGeometry(2800, 260, 44, 0xEAA402), ridgeMatNear);
    near.position.set(0, -10, -2760); near.scale.y = 1.55; near.userData.worldSurface = false; this.expanse.add(near);

    // A restrained kilometer-scale containment relic gives the open landscape a
    // memorable destination silhouette without filling it with props.
    const dark = new THREE.MeshStandardMaterial({ color: 0x151b21, roughness: .62, metalness: .68 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x8177f2, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending });
    const relic = new THREE.Group(); relic.position.set(620, 0, -2460);
    for (const x of [-58, 58]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(18, 190, 18), dark); p.position.set(x, 95, 0); relic.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(134, 10, 14), dark); beam.position.set(0, 178, 0); relic.add(beam);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(84, 2, 2), glow); slit.position.set(0, 169, -8); relic.add(slit);
    relic.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.userData.worldSurface = false; } });
    this.expanse.add(relic);
  }

  _buildVerticalParallax() {
    const rng = seeded(0xC17A4);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const farMat = new THREE.MeshStandardMaterial({ color: 0x070b10, roughness: .66, metalness: .45 });
    const midMat = new THREE.MeshStandardMaterial({ color: 0x101720, roughness: .52, metalness: .58 });
    const far = new THREE.InstancedMesh(boxGeo, farMat, 34);
    const mid = new THREE.InstancedMesh(boxGeo, midMat, 22);
    const d = new THREE.Object3D();

    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? -1 : 1;
      const h = 260 + rng() * 780, w = 58 + rng() * 170, dep = 65 + rng() * 210;
      d.position.set(side * (420 + rng() * 760), h * .44, -3220 - rng() * 1900);
      d.scale.set(w, h, dep); d.rotation.y = (rng() - .5) * .12; d.updateMatrix(); far.setMatrixAt(i, d.matrix);
    }
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? -1 : 1;
      const h = 180 + rng() * 560, w = 42 + rng() * 105, dep = 48 + rng() * 130;
      d.position.set(side * (220 + rng() * 430), h * .48, -3140 - rng() * 1500);
      d.scale.set(w, h, dep); d.rotation.y = (rng() - .5) * .08; d.updateMatrix(); mid.setMatrixAt(i, d.matrix);
    }
    far.castShadow = mid.castShadow = false; far.receiveShadow = mid.receiveShadow = false;
    far.userData.worldSurface = mid.userData.worldSurface = false; this.vertical.add(far, mid);

    // Transit lanes: one instanced draw, deliberately slower and larger than the
    // point-cloud traffic so movement helps sell true city depth.
    const podGeo = new THREE.BoxGeometry(7.5, 1.4, 2.2);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x25313d, emissive: 0x91b4d3, emissiveIntensity: 1.35, roughness: .25, metalness: .78 });
    this.transit = new THREE.InstancedMesh(podGeo, podMat, 18);
    this.transit.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 18; i++) this.transitData.push({
      x: (rng() - .5) * 1250,
      y: 120 + rng() * 650,
      z: -3180 - rng() * 1750,
      speed: 18 + rng() * 42,
      dir: rng() > .5 ? 1 : -1,
      phase: rng() * Math.PI * 2
    });
    this.transit.castShadow = false; this.transit.userData.worldSurface = false; this.vertical.add(this.transit);
  }

  _buildRegionalVeils() {
    const tex = softTexture('rgba(154,184,213,.26)', 'rgba(74,93,115,.08)');
    const defs = [
      [this.scar, 4, 850, 130],
      [this.expanse, 5, 1450, 180],
      [this.vertical, 7, 1100, 440]
    ];
    const rng = seeded(0xA7A404);
    for (const [group, count, spread, height] of defs) {
      for (let i = 0; i < count; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: .055 + rng() * .055, depthWrite: false, fog: false }));
        s.position.set((rng() - .5) * spread, 30 + rng() * height, group === this.scar ? 300 - rng() * 1000 : group === this.expanse ? -900 - rng() * 1800 : -3100 - rng() * 1550);
        const w = 260 + rng() * 520; s.scale.set(w, w * (.18 + rng() * .16), 1); group.add(s);
      }
    }
  }

  update(dt) {
    this.time += dt;
    const z = this.engine.camera.position.z;
    this.scar.visible = z > -900;
    this.expanse.visible = z < -450 && z > -3050;
    this.vertical.visible = z < -2200;

    if (this.vertical.visible && this.transit) {
      const d = _dummy;
      for (let i = 0; i < this.transitData.length; i++) {
        const t = this.transitData[i];
        t.z += t.speed * t.dir * dt;
        if (t.dir > 0 && t.z > -2980) t.z = -5000;
        if (t.dir < 0 && t.z < -5050) t.z = -3000;
        d.position.set(t.x + Math.sin(this.time * .12 + t.phase) * 32, t.y, t.z);
        d.rotation.set(0, t.dir > 0 ? 0 : Math.PI, 0); d.scale.set(1, 1, 1); d.updateMatrix(); this.transit.setMatrixAt(i, d.matrix);
      }
      this.transit.instanceMatrix.needsUpdate = true;
    }
  }
}

const _dummy = new THREE.Object3D();
