import * as THREE from 'three/webgpu';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvasTexture(w, h, paint, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); paint(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(seed, tint = '#9db6ce') {
  const rng = seeded(seed);
  return canvasTexture(384, 768, (x, w, h) => {
    x.fillStyle = '#05090e'; x.fillRect(0, 0, w, h);
    const cols = 12, rows = 38, cw = w / cols, rh = h / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const on = rng() > .57;
        const warm = rng() > .88;
        x.fillStyle = on ? (warm ? `rgba(215,157,91,${.3 + rng() * .45})` : tint) : `rgba(8,17,25,${.78 + rng() * .18})`;
        const px = 4 + rng() * 2, py = 4 + rng() * 3;
        x.fillRect(i * cw + px, j * rh + py, cw - px * 2, rh - py * 2);
      }
    }
    x.globalAlpha = .15; x.fillStyle = '#afc1d0';
    for (let i = 1; i < cols; i++) x.fillRect(i * cw - 1, 0, 2, h);
    for (let j = 1; j < rows; j++) x.fillRect(0, j * rh - 1, w, 2);
    x.globalAlpha = .22; x.fillStyle = '#020405';
    for (let i = 0; i < 18; i++) x.fillRect(rng() * w, rng() * h, 2 + rng() * 12, 30 + rng() * 160);
  });
}

function grimeTexture(seed) {
  const rng = seeded(seed);
  return canvasTexture(512, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 55; i++) {
      const px = rng() * w, py = rng() * h, rx = 12 + rng() * 85, ry = 8 + rng() * 45;
      const g = x.createRadialGradient(px, py, 0, px, py, rx);
      const a = .025 + rng() * .065;
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(px - rx, py - ry, rx * 2, ry * 2);
    }
    x.strokeStyle = 'rgba(205,214,222,.08)'; x.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      x.beginPath(); let px = rng() * w, py = rng() * h; x.moveTo(px, py);
      for (let j = 0; j < 6; j++) { px += (rng() - .5) * 70; py += 12 + rng() * 44; x.lineTo(px, py); }
      x.stroke();
    }
  }, false);
}

function softTexture(inner = 'rgba(210,229,246,.32)', mid = 'rgba(100,129,156,.12)') {
  return canvasTexture(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner); g.addColorStop(.35, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, false);
}

function box(group, size, pos, mat, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  m.position.set(...pos);
  if (opts.rotation) m.rotation.set(...opts.rotation);
  m.castShadow = opts.cast ?? false;
  m.receiveShadow = opts.receive ?? true;
  m.userData.worldSurface = opts.worldSurface ?? false;
  group.add(m); return m;
}

function addCollider(engine, size, pos, rotationY = 0) {
  const { world, RAPIER } = engine;
  if (!world || !RAPIER) return;
  const d = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...pos);
  if (rotationY) d.setRotation({ x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) });
  world.createCollider(d);
}

function cable(group, a, b, material, radius = .07) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A); const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 7), material);
  m.position.copy(A).add(B).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = false; m.receiveShadow = false; m.userData.worldSurface = false;
  group.add(m); return m;
}

export class VisualCeilingWorldIII {
  constructor(engine, mats) {
    this.engine = engine;
    this.mats = mats;
    this.root = new THREE.Group(); this.root.name = 'Visual Ceiling III';
    this.scar = new THREE.Group(); this.scar.name = 'Scar Hero District';
    this.expanse = new THREE.Group(); this.expanse.name = 'Expanse Hero Detail';
    this.vertical = new THREE.Group(); this.vertical.name = 'Vertical Understructure';
    this.root.add(this.scar, this.expanse, this.vertical);
    engine.scene.add(this.root);
    this._time = 0;
    this._built = false;
    this.transit = null;
    this.transitData = [];
    this.verticalLights = [];
    this.scarLights = [];
  }

  build() {
    if (this._built) return;
    this._built = true;
    this._makeMaterials();
    this._buildScarHeroDistrict();
    this._buildExpanseDetail();
    this._buildVerticalUnderstructure();
    this._buildRegionalAtmosphere();
    this.engine.onUpdate?.((dt) => this.update(dt));
  }

  _makeMaterials() {
    const f1 = facadeTexture(0xACE311, 'rgba(155,190,221,.78)');
    const f2 = facadeTexture(0xACE312, 'rgba(135,127,255,.66)');
    this.facadeCool = new THREE.MeshStandardMaterial({ map: f1, emissiveMap: f1, emissive: 0x6d879d, emissiveIntensity: .72, roughness: .31, metalness: .34 });
    this.facadeSpectral = new THREE.MeshStandardMaterial({ map: f2, emissiveMap: f2, emissive: 0x6d62d2, emissiveIntensity: .82, roughness: .28, metalness: .38 });
    const grime = grimeTexture(0x6A11E);
    grime.repeat.set(5, 18);
    this.grimeMat = new THREE.MeshBasicMaterial({ map: grime, transparent: true, opacity: .75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.dark = new THREE.MeshStandardMaterial({ color: 0x0a1016, roughness: .58, metalness: .72 });
    this.steel = new THREE.MeshStandardMaterial({ color: 0x4d5964, roughness: .38, metalness: .88 });
    this.concrete = new THREE.MeshStandardMaterial({ color: 0x343d43, roughness: .91, metalness: .04 });
    this.wet = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: .12, metalness: .16, transparent: true, opacity: .82 });
    this.coolGlow = new THREE.MeshBasicMaterial({ color: 0xaac7e2, transparent: true, opacity: .62, depthWrite: false, blending: THREE.AdditiveBlending });
    this.spectralGlow = new THREE.MeshBasicMaterial({ color: 0x8b82ff, transparent: true, opacity: .58, depthWrite: false, blending: THREE.AdditiveBlending });
    this.hazeMat = new THREE.SpriteMaterial({ map: softTexture(), transparent: true, opacity: .12, depthWrite: false, fog: false });
    this.dustMat = new THREE.MeshBasicMaterial({ map: softTexture('rgba(177,180,165,.22)', 'rgba(105,111,103,.10)'), transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide, fog: false });
  }

  _buildScarHeroDistrict() {
    // A single authored composition in The Scar: containment gantry, layered
    // service fronts, catwalks, wet road history and utilities. It is deliberately
    // denser than the rest of the district so we have a screenshot-quality test.
    const z0 = -245;
    for (const side of [-1, 1]) {
      box(this.scar, [8, 30, 13], [side * 72, 15, z0], this.dark, { cast: true, worldSurface: true });
      box(this.scar, [5.5, 26, 13.6], [side * 72, 15.5, z0], this.steel, { worldSurface: false });
      addCollider(this.engine, [8, 30, 13], [side * 72, 15, z0]);

      const service = box(this.scar, [1, 22, 74], [side * 64.3, 12, z0 - 34], side < 0 ? this.facadeCool : this.facadeSpectral, { receive: false });
      service.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (let y = 5; y < 22; y += 5.5) box(this.scar, [10, .34, 76], [side * 67, y, z0 - 34], this.steel);

      for (let i = 0; i < 7; i++) {
        const z = z0 + 38 - i * 13;
        box(this.scar, [3.8, .15, .18], [side * 59.5, 6.2 + (i % 2) * 1.2, z], this.coolGlow, { receive: false });
      }
    }

    box(this.scar, [150, 4.2, 14], [0, 27.5, z0], this.dark, { cast: true, worldSurface: true });
    box(this.scar, [118, .42, 14.7], [0, 29.7, z0], this.steel);
    box(this.scar, [52, .18, 15], [0, 30.1, z0], this.spectralGlow, { receive: false });
    addCollider(this.engine, [150, 4.2, 14], [0, 27.5, z0]);

    // Road wear and wet patches catch local light without needing SSR.
    const roadGrime = new THREE.Mesh(new THREE.PlaneGeometry(96, 360), this.grimeMat);
    roadGrime.rotation.x = -Math.PI / 2; roadGrime.position.set(0, .132, -220); roadGrime.userData.worldSurface = false; this.scar.add(roadGrime);
    const rng = seeded(0x5CA311);
    for (let i = 0; i < 22; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1, 18), this.wet);
      p.rotation.x = -Math.PI / 2; p.position.set((rng() - .5) * 86, .137, 350 - rng() * 900);
      p.scale.set(1.4 + rng() * 5.5, .45 + rng() * 2, 1); p.userData.worldSurface = false; this.scar.add(p);
    }

    // Overhead utilities add parallax and make the boulevard feel inhabited.
    for (let i = 0; i < 7; i++) {
      const z = 370 - i * 128;
      cable(this.scar, [-62, 10 + (i % 2) * 3, z], [62, 13 + ((i + 1) % 2) * 2, z - 5], this.dark, .055);
      cable(this.scar, [-61, 8.5, z + 2], [61, 9.5, z - 1], this.dark, .035);
    }

    for (const [x, z, color] of [[-47,-120,0x9fc6e6],[48,-330,0x857cff],[-47,-480,0xb5cde1],[47,80,0xd6a56b]]) {
      const l = new THREE.PointLight(color, 4.5, 42, 2.0); l.position.set(x, 7.5, z); l.castShadow = false; this.scar.add(l); this.scarLights.push(l);
    }
  }

  _buildExpanseDetail() {
    const rng = seeded(0xE7A115);
    // Cut banks run beside the highway but leave the central combat corridor wide.
    const makeBank = (side) => {
      const geo = new THREE.PlaneGeometry(230, 2050, 10, 60); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const edge = Math.abs(x) / 115;
        p.setY(i, .3 + edge * edge * 11 + Math.sin(z * .016 + side) * 1.7 + Math.sin(x * .06) * .8);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.concrete); m.position.set(side * 180, -.2, -1720); m.receiveShadow = true; m.userData.worldSurface = false; this.expanse.add(m);
    };
    makeBank(-1); makeBank(1);

    // Drainage, utility remnants and rockfall sell the highway as engineered terrain.
    for (const side of [-1, 1]) {
      box(this.expanse, [5, .32, 1950], [side * 66, .15, -1710], this.dark, { receive: false });
      for (let i = 0; i < 13; i++) {
        const z = -820 - i * 145;
        box(this.expanse, [1.1, 7 + (i % 3) * 2.5, 1.1], [side * (92 + (i % 2) * 18), 3.5, z], this.steel);
        if (i % 3 === 0) cable(this.expanse, [side * 94, 8, z], [side * 118, 12, z - 120], this.dark, .045);
      }
    }

    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x3b4241, roughness: .96, metalness: 0 }), 150);
    const d = new THREE.Object3D();
    for (let i = 0; i < 150; i++) {
      const side = i % 2 ? -1 : 1, s = .8 + rng() * 4.8;
      d.position.set(side * (72 + rng() * 220), s * .35, -760 - rng() * 2000);
      d.scale.set(s * (1 + rng()), s * (.5 + rng()), s); d.rotation.set(rng(), rng() * Math.PI, rng()); d.updateMatrix(); rocks.setMatrixAt(i, d.matrix);
    }
    rocks.castShadow = false; rocks.receiveShadow = true; rocks.userData.worldSurface = false; this.expanse.add(rocks);

    // Broad wind sheets move as whole meshes; no per-particle CPU simulation.
    this.dustSheets = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(280 + rng() * 360, 90 + rng() * 120), this.dustMat.clone());
      s.position.set((rng() - .5) * 900, 22 + rng() * 90, -850 - rng() * 1750);
      s.rotation.y = (rng() - .5) * .35; s.material.opacity = .045 + rng() * .07; this.expanse.add(s); this.dustSheets.push({ mesh: s, speed: 2 + rng() * 6 });
    }
  }

  _buildVerticalUnderstructure() {
    // Lower-city understructure: giant trusses, service decks and lit cavities make
    // the suspended districts feel supported rather than like floating boxes.
    const zRows = [-3230, -3410, -3590, -3770];
    for (let row = 0; row < zRows.length; row++) {
      const z = zRows[row], y = 36 + row * 30;
      for (const side of [-1, 1]) {
        const x = side * (118 + row * 16);
        box(this.vertical, [16, y + 34, 16], [x, (y + 34) / 2, z], this.dark, { cast: true, worldSurface: true });
        addCollider(this.engine, [16, y + 34, 16], [x, (y + 34) / 2, z]);
        box(this.vertical, [82, 3.2, 18], [side * 75, y + 12, z], this.steel, { worldSurface: true });
        addCollider(this.engine, [82, 3.2, 18], [side * 75, y + 12, z]);
        for (let k = 0; k < 4; k++) {
          const beam = box(this.vertical, [3.2, 3.2, 86], [side * (64 + k * 12), y - 7, z], this.dark, { rotation: [0, 0, side * (.22 - k * .04)] });
          beam.userData.worldSurface = false;
        }
      }
      if (row < 3) {
        box(this.vertical, [190 + row * 35, 2.6, 14], [0, y + 24, z - 74], this.dark, { worldSurface: true });
        addCollider(this.engine, [190 + row * 35, 2.6, 14], [0, y + 24, z - 74]);
      }
    }

    // False interior skins create readable inhabited depth at street and flight range.
    for (const [x,z,w,h,side] of [[-148,-3290,100,260,1],[154,-3310,106,310,-1],[-250,-3520,128,390,1],[258,-3550,124,440,-1],[-112,-3740,94,490,1],[122,-3780,102,540,-1]]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), side > 0 ? this.facadeSpectral : this.facadeCool);
      f.position.set(x, h * .5, z); f.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; f.userData.worldSurface = false; this.vertical.add(f);
    }

    // Actual small transit silhouettes rather than only points. One dynamic draw call.
    const podGeo = new THREE.BoxGeometry(5.5, 1.25, 2.0);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x1b2630, emissive: 0x8fb9de, emissiveIntensity: 1.6, roughness: .27, metalness: .74 });
    this.transit = new THREE.InstancedMesh(podGeo, podMat, 24);
    this.transit.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const rng = seeded(0xC17F331);
    for (let i = 0; i < 24; i++) this.transitData.push({
      x: (rng() - .5) * 760,
      y: 70 + rng() * 520,
      z: -3180 - rng() * 1550,
      speed: 24 + rng() * 62,
      dir: rng() > .5 ? 1 : -1,
      phase: rng() * Math.PI * 2
    });
    this.transit.frustumCulled = true; this.transit.castShadow = false; this.transit.userData.worldSurface = false; this.vertical.add(this.transit);

    for (const [x,y,z,color] of [[-62,70,-3260,0x9fc7e5],[68,105,-3440,0x827aff],[-90,160,-3630,0xa7cbe7],[98,215,-3830,0x8a82ff]]) {
      const l = new THREE.PointLight(color, 7, 90, 1.8); l.position.set(x,y,z); l.castShadow = false; this.vertical.add(l); this.verticalLights.push(l);
    }
  }

  _buildRegionalAtmosphere() {
    // Local haze sprites are activated by region, preserving silhouettes without
    // making the whole map pay the transparent-overdraw cost at once.
    const rng = seeded(0xA7A0331);
    for (const [group, count, zMin, zMax, yMax] of [[this.scar,10,-620,480,110],[this.expanse,12,-2700,-700,160],[this.vertical,16,-4700,-3000,620]]) {
      for (let i = 0; i < count; i++) {
        const s = new THREE.Sprite(this.hazeMat.clone());
        s.position.set((rng() - .5) * (group === this.vertical ? 1100 : 800), 18 + rng() * yMax, zMin + rng() * (zMax - zMin));
        const w = 160 + rng() * 420; s.scale.set(w, w * (.2 + rng() * .22), 1); s.material.opacity = .045 + rng() * .085; group.add(s);
      }
    }
  }

  update(dt) {
    this._time += dt;
    const cam = this.engine.camera.position;

    // Heavy hero detail only participates near its own region. Visual Ceiling I/II
    // continue supplying the long-distance horizon, so these switches are difficult
    // to perceive but substantially reduce overdraw and local-light work.
    this.scar.visible = cam.z > -1050;
    this.expanse.visible = cam.z < -420 && cam.z > -3100;
    this.vertical.visible = cam.z < -2250;

    for (const l of this.scarLights) l.intensity = this.scar.visible ? 4.2 + Math.sin(this._time * .7 + l.position.z) * .25 : 0;
    for (const l of this.verticalLights) l.intensity = this.vertical.visible ? 6.6 + Math.sin(this._time * .45 + l.position.y) * .35 : 0;

    if (this.expanse.visible && this.dustSheets) {
      for (const d of this.dustSheets) {
        d.mesh.position.x += d.speed * dt;
        if (d.mesh.position.x > 620) d.mesh.position.x = -620;
      }
    }

    if (this.vertical.visible && this.transit) {
      const dummy = _dummy;
      for (let i = 0; i < this.transitData.length; i++) {
        const t = this.transitData[i];
        t.z += t.speed * t.dir * dt;
        if (t.dir > 0 && t.z > -3020) t.z = -4780;
        if (t.dir < 0 && t.z < -4820) t.z = -3040;
        dummy.position.set(t.x + Math.sin(this._time * .13 + t.phase) * 24, t.y + Math.sin(this._time * .31 + t.phase) * 4, t.z);
        dummy.rotation.set(0, t.dir > 0 ? 0 : Math.PI, 0); dummy.scale.set(1,1,1); dummy.updateMatrix(); this.transit.setMatrixAt(i, dummy.matrix);
      }
      this.transit.instanceMatrix.needsUpdate = true;
    }
  }
}

const _dummy = new THREE.Object3D();
