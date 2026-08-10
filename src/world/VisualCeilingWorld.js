import * as THREE from 'three/webgpu';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvasTexture(size, paint, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function asphaltTexture() {
  const rng = seeded(0xA511FA17);
  return canvasTexture(512, (x, s) => {
    x.fillStyle = '#151a20'; x.fillRect(0, 0, s, s);
    const img = x.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rng() - .5) * 30;
      img.data[i] = Math.max(10, Math.min(55, img.data[i] + n));
      img.data[i + 1] = Math.max(12, Math.min(60, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(16, Math.min(64, img.data[i + 2] + n));
    }
    x.putImageData(img, 0, 0);
    x.globalAlpha = .18;
    for (let i = 0; i < 34; i++) {
      const px = rng() * s, py = rng() * s, r = 10 + rng() * 65;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, rng() > .5 ? '#6e7780' : '#030507'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    x.globalAlpha = .28; x.strokeStyle = '#05080b'; x.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) {
      let px = rng() * s, py = rng() * s; x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 5; j++) { px += (rng() - .5) * 52; py += (rng() - .5) * 28; x.lineTo(px, py); }
      x.stroke();
    }
  });
}

function terrainTexture() {
  const rng = seeded(0xE5FA9E);
  return canvasTexture(512, (x, s) => {
    const g = x.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#222a2a'); g.addColorStop(.45, '#2c312e'); g.addColorStop(1, '#161d20');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    x.globalAlpha = .2;
    for (let i = 0; i < 2600; i++) {
      const v = 45 + Math.floor(rng() * 40);
      x.fillStyle = `rgb(${v},${v + 4},${Math.max(30, v - 4)})`;
      const r = .4 + rng() * 2.2; x.fillRect(rng() * s, rng() * s, r, r);
    }
    x.globalAlpha = .14;
    for (let i = 0; i < 45; i++) {
      x.strokeStyle = rng() > .5 ? '#080c0e' : '#7d7868'; x.lineWidth = .5 + rng() * 1.7;
      x.beginPath(); let px = rng() * s, py = rng() * s; x.moveTo(px, py);
      for (let j = 0; j < 6; j++) { px += (rng() - .5) * 70; py += (rng() - .5) * 34; x.lineTo(px, py); }
      x.stroke();
    }
  });
}

function windowTexture() {
  const rng = seeded(0xC17A5E);
  return canvasTexture(512, (x, s) => {
    x.fillStyle = '#04070a'; x.fillRect(0, 0, s, s);
    const cols = 16, rows = 28, cw = s / cols, rh = s / rows;
    for (let yy = 0; yy < rows; yy++) {
      for (let xx = 0; xx < cols; xx++) {
        const lit = rng() > .63;
        const warm = rng() > .83;
        x.fillStyle = lit ? (warm ? '#b88858' : '#708ba7') : (rng() > .72 ? '#14202a' : '#080d12');
        const padX = cw * (.18 + rng() * .08), padY = rh * (.20 + rng() * .08);
        x.fillRect(xx * cw + padX, yy * rh + padY, cw - padX * 2, rh - padY * 2);
      }
    }
    x.globalAlpha = .18; x.strokeStyle = '#84909a'; x.lineWidth = 1;
    for (let i = 0; i <= cols; i++) { x.beginPath(); x.moveTo(i * cw, 0); x.lineTo(i * cw, s); x.stroke(); }
  });
}

function radialTexture() {
  return canvasTexture(256, (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(170,196,225,.40)');
    g.addColorStop(.22, 'rgba(105,128,156,.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }, false);
}

function shaftTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(160,184,215,0)');
  g.addColorStop(.28, 'rgba(130,158,190,.12)');
  g.addColorStop(.72, 'rgba(113,136,169,.08)');
  g.addColorStop(1, 'rgba(100,120,150,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class VisualCeilingWorld {
  constructor(engine, mats) {
    this.engine = engine;
    this.mats = mats;
    this.group = new THREE.Group();
    this.group.name = 'Visual Ceiling I // asset-free dressing';
    engine.scene.add(this.group);
    this.traffic = null;
    this.trafficVel = null;
    this.built = false;
    this.time = 0;
    this.baseExposure = engine.renderer?.toneMappingExposure ?? .86;
  }

  build() {
    if (this.built) return;
    this.built = true;
    this._makeMaterials();
    this._addRoadSurfacePass();
    this._addScarDetailPass();
    this._addExpanseLandscapePass();
    this._addVerticalMegacityPass();
    this._addAtmosphericDepthPass();
    this.engine.onUpdate((dt) => this.update(dt));
  }

  _makeMaterials() {
    const asphalt = asphaltTexture(); asphalt.repeat.set(6, 80);
    this.asphaltMat = new THREE.MeshStandardMaterial({ map: asphalt, color: 0xb8c0c8, roughness: .78, metalness: .08, polygonOffset: true, polygonOffsetFactor: -2 });
    const terrain = terrainTexture(); terrain.repeat.set(12, 18);
    this.terrainMat = new THREE.MeshStandardMaterial({ map: terrain, color: 0xaeb3aa, roughness: .97, metalness: .01 });
    const windows = windowTexture(); windows.repeat.set(1, 1);
    this.windowMat = new THREE.MeshStandardMaterial({ map: windows, emissiveMap: windows, emissive: 0x71879e, emissiveIntensity: .68, roughness: .36, metalness: .18 });
    this.coolLight = new THREE.MeshBasicMaterial({ color: 0x9cbbe0, transparent: true, opacity: .62, blending: THREE.AdditiveBlending, depthWrite: false });
    this.warmLight = new THREE.MeshBasicMaterial({ color: 0xe0a565, transparent: true, opacity: .48, blending: THREE.AdditiveBlending, depthWrite: false });
    this.hazeMat = new THREE.SpriteMaterial({ map: radialTexture(), transparent: true, opacity: .23, depthWrite: false, fog: false });
    this.shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), color: 0x8ea8c5, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  }

  _roadSkin(x, z, w, l, rot = 0) {
    const geo = new THREE.PlaneGeometry(w * .84, l * .965, 1, 1); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, this.asphaltMat);
    m.position.set(x, .119, z); m.rotation.y = rot; m.receiveShadow = true; m.userData.worldSurface = false; this.group.add(m);
  }

  _addRoadSurfacePass() {
    [
      [0, 90, 104, 1250, 0], [-245, 110, 60, 620, Math.PI / 2], [250, -50, 58, 620, Math.PI / 2],
      [0, -1730, 58, 2180, 0], [-210, -1510, 22, 640, .04], [235, -2100, 24, 720, -.06],
      [0, -2920, 92, 620, 0]
    ].forEach((r) => this._roadSkin(...r));

    const geo = new THREE.BoxGeometry(.18, .035, 1.8);
    const mesh = new THREE.InstancedMesh(geo, this.coolLight, 260);
    const d = new THREE.Object3D(); let n = 0;
    for (const x of [-45, 45]) {
      for (let z = 530; z > -615; z -= 18) {
        d.position.set(x, .145, z); d.rotation.y = 0; d.updateMatrix(); mesh.setMatrixAt(n++, d.matrix);
      }
    }
    for (const x of [-26, 26]) {
      for (let z = -710; z > -2710; z -= 30) {
        d.position.set(x, .145, z); d.updateMatrix(); mesh.setMatrixAt(n++, d.matrix);
        if (n >= 260) break;
      }
    }
    mesh.count = n; mesh.frustumCulled = true; mesh.userData.worldSurface = false; this.group.add(mesh);
  }

  _facade(x, z, width, height, facingX) {
    const geo = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geo, this.windowMat);
    mesh.position.set(x, height * .50, z);
    mesh.rotation.y = facingX > 0 ? Math.PI / 2 : -Math.PI / 2;
    mesh.userData.worldSurface = false; mesh.castShadow = false; mesh.receiveShadow = false; this.group.add(mesh);
  }

  _addScarDetailPass() {
    const blocks = [
      [-115,390,64,76,102], [118,370,70,82,126], [-154,230,92,88,158], [154,205,84,96,146],
      [-126,50,92,90,194], [132,20,88,96,178], [-176,-150,122,106,226], [176,-170,112,104,214],
      [-158,-390,118,118,252], [166,-410,126,112,236]
    ];
    for (const [x,z,w,d,h] of blocks) {
      const left = x < 0;
      this._facade(x + (left ? w * .505 : -w * .505), z, d * .82, h * .78, left ? 1 : -1);
    }

    const postGeo = new THREE.CylinderGeometry(.10, .14, 8.5, 8);
    const lampGeo = new THREE.BoxGeometry(.32, .14, 1.4);
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x151c24, roughness: .42, metalness: .74 }), 54);
    const lamps = new THREE.InstancedMesh(lampGeo, this.coolLight, 54);
    const d = new THREE.Object3D(); let n = 0;
    for (let z = 500; z > -590; z -= 42) {
      for (const x of [-54, 54]) {
        d.position.set(x, 4.25, z); d.updateMatrix(); posts.setMatrixAt(n, d.matrix);
        d.position.set(x + (x < 0 ? 1.0 : -1.0), 8.3, z); d.updateMatrix(); lamps.setMatrixAt(n, d.matrix); n++;
      }
    }
    posts.count = lamps.count = n; posts.userData.worldSurface = lamps.userData.worldSurface = false; this.group.add(posts, lamps);

    const amberGeo = new THREE.BoxGeometry(.10, 2.8, .10);
    const amber = new THREE.InstancedMesh(amberGeo, this.warmLight, 28); n = 0;
    for (let z = 430; z > -520; z -= 74) for (const x of [-63, 63]) { d.position.set(x, 2.2, z); d.updateMatrix(); amber.setMatrixAt(n++, d.matrix); }
    amber.count = n; amber.userData.worldSurface = false; this.group.add(amber);
  }

  _terrainRibbon(side) {
    const width = 760, length = 2200;
    const geo = new THREE.PlaneGeometry(width, length, 32, 70); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const edge = Math.max(0, Math.abs(x) / (width * .5));
      const h = Math.pow(edge, 1.7) * 48 + Math.sin(z * .012 + side) * 6 + Math.sin(x * .035) * 3;
      p.setY(i, Math.max(-2, h));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.position.set(side * 720, -1.2, -1720); mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData.worldSurface = false; this.group.add(mesh);
  }

  _addExpanseLandscapePass() {
    this._terrainRibbon(-1); this._terrainRibbon(1);
    const rng = seeded(0xE115CA9E);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x32393d, roughness: .93, metalness: .02 }), 180);
    const d = new THREE.Object3D();
    for (let i = 0; i < 180; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (420 + rng() * 720), z = -720 - rng() * 2050;
      const s = 1.8 + rng() * 12;
      d.position.set(x, s * .35, z); d.scale.set(s * (1 + rng()), s * (.45 + rng() * .7), s * (.8 + rng())); d.rotation.set(rng() * .8, rng() * Math.PI, rng() * .5); d.updateMatrix(); rocks.setMatrixAt(i, d.matrix);
    }
    rocks.castShadow = false; rocks.receiveShadow = true; rocks.userData.worldSurface = false; this.group.add(rocks);

    const scrubGeo = new THREE.ConeGeometry(.18, 1.2, 4);
    const scrub = new THREE.InstancedMesh(scrubGeo, new THREE.MeshStandardMaterial({ color: 0x55605a, roughness: 1 }), 420);
    for (let i = 0; i < 420; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (120 + rng() * 520), z = -720 - rng() * 2050;
      const s = .45 + rng() * 1.6; d.position.set(x, .18, z); d.scale.set(s, s, s); d.rotation.y = rng() * Math.PI; d.updateMatrix(); scrub.setMatrixAt(i, d.matrix);
    }
    scrub.castShadow = false; scrub.receiveShadow = false; scrub.userData.worldSurface = false; this.group.add(scrub);
  }

  _addVerticalMegacityPass() {
    const lower = [
      [-210,-3290,116,124,330], [220,-3310,132,116,390], [-340,-3520,150,140,470], [350,-3550,142,152,520],
      [-170,-3740,124,136,590], [190,-3780,138,130,640]
    ];
    for (const [x,z,w,d,h] of lower) {
      const left = x < 0; this._facade(x + (left ? w * .505 : -w * .505), z, d * .86, h * .84, left ? 1 : -1);
    }

    const rng = seeded(0xC17F1001);
    const stripGeo = new THREE.BoxGeometry(.24, 1, .12);
    const strips = new THREE.InstancedMesh(stripGeo, this.coolLight, 520);
    const d = new THREE.Object3D();
    for (let i = 0; i < 520; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (115 + rng() * 680), y = 35 + rng() * 760, z = -3150 - rng() * 1500;
      d.position.set(x, y, z); d.scale.set(1, 3 + rng() * 28, 1); d.rotation.y = rng() * .18; d.updateMatrix(); strips.setMatrixAt(i, d.matrix);
    }
    strips.userData.worldSurface = false; this.group.add(strips);

    const count = 880, geo = new THREE.BufferGeometry(), positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? -1 : 1;
      positions[i * 3] = side * (130 + rng() * 830);
      positions[i * 3 + 1] = 18 + rng() * 930;
      positions[i * 3 + 2] = -3180 - rng() * 1750;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.cityLights = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xa7c0de, size: 1.15, transparent: true, opacity: .48, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.cityLights.frustumCulled = false; this.group.add(this.cityLights);

    const trafficCount = 64, trafficGeo = new THREE.BufferGeometry(), tp = new Float32Array(trafficCount * 3), tv = new Float32Array(trafficCount);
    for (let i = 0; i < trafficCount; i++) {
      tp[i * 3] = (rng() - .5) * 1050; tp[i * 3 + 1] = 80 + rng() * 620; tp[i * 3 + 2] = -3100 - rng() * 1800; tv[i] = 30 + rng() * 85;
    }
    trafficGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3)); this.trafficVel = tv;
    this.traffic = new THREE.Points(trafficGeo, new THREE.PointsMaterial({ color: 0xd6e9ff, size: 2.0, transparent: true, opacity: .68, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.traffic.frustumCulled = false; this.group.add(this.traffic);

    for (const [x,y,z,sx,sy,rot] of [[-72,300,-3410,90,720,.05],[82,420,-3670,70,900,-.08],[-110,520,-4100,110,1040,.03]]) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), this.shaftMat.clone());
      shaft.position.set(x,y,z); shaft.rotation.y = rot; shaft.userData.worldSurface = false; this.group.add(shaft);
    }
  }

  _addAtmosphericDepthPass() {
    const rng = seeded(0xA7A05F);
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(this.hazeMat.clone());
      const region = i < 12 ? 0 : i < 22 ? 1 : 2;
      if (region === 0) s.position.set((rng() - .5) * 900, 35 + rng() * 120, 480 - rng() * 1200);
      else if (region === 1) s.position.set((rng() - .5) * 1700, 25 + rng() * 170, -800 - rng() * 1850);
      else s.position.set((rng() - .5) * 1300, 70 + rng() * 520, -3050 - rng() * 1650);
      const w = 170 + rng() * 480; s.scale.set(w, w * (.24 + rng() * .24), 1); s.material.opacity = .08 + rng() * .15; this.group.add(s);
    }

    this.scarFill = new THREE.PointLight(0x9bb9d8, 9, 210, 1.7); this.scarFill.position.set(0, 48, -80); this.scarFill.castShadow = false; this.group.add(this.scarFill);
    this.cityFill = new THREE.PointLight(0x7d79dc, 14, 360, 1.45); this.cityFill.position.set(0, 190, -3450); this.cityFill.castShadow = false; this.group.add(this.cityFill);
  }

  update(dt) {
    this.time += dt;
    const cam = this.engine.camera.position;
    const vertical = cam.z < -2700, expanse = cam.z < -690 && !vertical;
    const exposureTarget = vertical ? .79 : expanse ? .97 : .89;
    if (this.engine.renderer) this.engine.renderer.toneMappingExposure = THREE.MathUtils.damp(this.engine.renderer.toneMappingExposure, exposureTarget, .65, dt);
    if (this.engine.scene.environmentIntensity !== undefined) this.engine.scene.environmentIntensity = THREE.MathUtils.damp(this.engine.scene.environmentIntensity, vertical ? .26 : expanse ? .40 : .34, .8, dt);
    this.cityFill.intensity = THREE.MathUtils.damp(this.cityFill.intensity, vertical ? 17 : 7, 1.2, dt);
    this.scarFill.intensity = THREE.MathUtils.damp(this.scarFill.intensity, cam.z > -700 ? 8 : 2, 1.2, dt);

    if (this.traffic) {
      const p = this.traffic.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let z = p.getZ(i) + this.trafficVel[i] * dt;
        if (z > -3050) z = -4880;
        p.setZ(i, z);
      }
      p.needsUpdate = true;
    }
    if (this.cityLights?.material) this.cityLights.material.opacity = .42 + Math.sin(this.time * .17) * .035;
  }
}
