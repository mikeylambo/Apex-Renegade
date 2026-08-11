import * as THREE from 'three/webgpu';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smooth01(v) { const t = clamp01(v); return t * t * (3 - 2 * t); }

function canvasTexture(w, h, paint, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  paint(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWindowTexture(seed = 1, accent = '#8d85ff') {
  const rng = seeded(seed);
  return canvasTexture(256, 512, (x, w, h) => {
    x.fillStyle = '#080d13'; x.fillRect(0, 0, w, h);
    const cols = 8, rows = 24, cw = w / cols, rh = h / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const lit = rng() > .58;
        const cool = rng() > .17;
        x.fillStyle = lit ? (cool ? `rgba(185,211,235,${.34 + rng() * .46})` : accent) : `rgba(8,16,24,${.75 + rng() * .2})`;
        const padX = 3 + rng() * 2, padY = 4 + rng() * 3;
        x.fillRect(i * cw + padX, j * rh + padY, cw - padX * 2, rh - padY * 2);
      }
    }
    x.fillStyle = 'rgba(120,136,153,.12)';
    for (let i = 1; i < cols; i++) x.fillRect(i * cw - 1, 0, 2, h);
    for (let j = 1; j < rows; j++) x.fillRect(0, j * rh - 1, w, 2);
  });
}

function makeRoadDecalTexture(seed = 1) {
  const rng = seeded(seed);
  return canvasTexture(512, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) {
      const px = rng() * w, py = rng() * h, r = 16 + rng() * 80;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      const a = .035 + rng() * .075;
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(.55, `rgba(12,18,22,${a * .5})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    x.strokeStyle = 'rgba(195,205,214,.08)'; x.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      x.beginPath();
      let px = rng() * w, py = rng() * h;
      x.moveTo(px, py);
      for (let j = 0; j < 5; j++) { px += (rng() - .5) * 90; py += 20 + rng() * 70; x.lineTo(px, py); }
      x.stroke();
    }
  }, false);
}

function makeSoftDisc() {
  return canvasTexture(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(220,233,247,.34)');
    g.addColorStop(.35, 'rgba(112,132,154,.14)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, false);
}

function addStaticCollider(engine, size, pos, rotationY = 0) {
  const { world, RAPIER } = engine;
  if (!world || !RAPIER) return;
  const d = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(pos[0], pos[1], pos[2]);
  if (rotationY) d.setRotation({ x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) });
  world.createCollider(d);
}

function box(group, size, pos, mat, { cast = false, receive = true, rotation = null, worldSurface = false } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rotation) m.rotation.set(rotation[0], rotation[1], rotation[2]);
  m.castShadow = cast; m.receiveShadow = receive; m.userData.worldSurface = worldSurface;
  group.add(m); return m;
}

export class VisualCeilingWorldII {
  constructor(engine, mats) {
    this.engine = engine;
    this.mats = mats;
    this.root = new THREE.Group();
    this.root.name = 'Visual Ceiling II';
    this.dynamic = [];
    this._time = 0;
    this._built = false;
    this._matrix = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._pos = new THREE.Vector3();
    engine.scene.add(this.root);
  }

  build() {
    if (this._built) return;
    this._built = true;
    this._buildExpanseTerrain();
    this._buildScarStreetLayer();
    this._buildExpanseRoadLayer();
    this._buildVerticalCanyon();
    this._buildAtmosphericDepth();
    this.engine.onUpdate?.((dt) => this.update(dt));
  }

  _buildExpanseTerrain() {
    const rng = seeded(0xC3111A2);
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x202a2f, roughness: .97, metalness: 0, vertexColors: true });
    const makeStrip = (side) => {
      const width = 980, length = 2500;
      const geo = new THREE.PlaneGeometry(width, length, 28, 74);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      const colors = new Float32Array(p.count * 3);
      const centerX = side * 820;
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i), z = p.getZ(i), wx = lx + centerX;
        const edge = smooth01((Math.abs(wx) - 310) / 860);
        const macro = Math.sin(wx * .0068 + z * .0042) * 7.5 + Math.sin(z * .0091 - wx * .0027) * 4.2;
        const ridges = Math.abs(Math.sin(wx * .0105 + z * .0051)) * 10.5;
        const y = -.12 + edge * (7 + macro + ridges) + edge * edge * 10;
        p.setY(i, y);
        const shade = clamp01(.30 + y * .012 + (rng() - .5) * .055);
        colors[i * 3] = .10 + shade * .12;
        colors[i * 3 + 1] = .13 + shade * .14;
        colors[i * 3 + 2] = .14 + shade * .12;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, terrainMat);
      mesh.position.set(centerX, 0, -1710);
      mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData.worldSurface = false;
      this.root.add(mesh);
    };
    makeStrip(-1); makeStrip(1);

    // Far silhouettes are deliberately simple; atmospheric perspective does the work.
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x10171d, roughness: 1, metalness: 0 });
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? -1 : 1;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), mountainMat);
      const h = 130 + rng() * 360, w = 110 + rng() * 310, d = 120 + rng() * 330;
      rock.scale.set(w, h, d);
      rock.position.set(side * (760 + rng() * 430), h * .48 - 8, -760 - rng() * 2450);
      rock.rotation.set((rng() - .5) * .13, rng() * Math.PI, (rng() - .5) * .08);
      rock.castShadow = false; rock.receiveShadow = false; rock.userData.worldSurface = false;
      this.root.add(rock);
    }

    // Low scrub uses one draw call and gives the Expanse a much stronger ground scale.
    const scrubGeo = new THREE.ConeGeometry(.32, 1.05, 5);
    const scrubMat = new THREE.MeshStandardMaterial({ color: 0x334039, roughness: 1, metalness: 0 });
    const count = 420;
    const scrub = new THREE.InstancedMesh(scrubGeo, scrubMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const side = rng() > .5 ? -1 : 1;
      const x = side * (65 + rng() * 630);
      const z = -720 - rng() * 2100;
      const s = .45 + rng() * 1.45;
      dummy.position.set(x, .18 + s * .2, z);
      dummy.scale.set(s * (.7 + rng() * .5), s, s * (.7 + rng() * .5));
      dummy.rotation.y = rng() * Math.PI;
      dummy.updateMatrix(); scrub.setMatrixAt(i, dummy.matrix);
    }
    scrub.castShadow = false; scrub.receiveShadow = false; scrub.frustumCulled = true; scrub.userData.worldSurface = false;
    this.root.add(scrub);
  }

  _buildScarStreetLayer() {
    const rng = seeded(0x5CA2D311);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x39434c, roughness: .90, metalness: .05 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x687580, roughness: .68, metalness: .25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b1016, roughness: .55, metalness: .67 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x9db2c8, emissive: 0x91b8d7, emissiveIntensity: 1.45, roughness: .22, metalness: .34 });

    // Sidewalk/curb bands break the giant-road-plane look without shrinking combat space.
    for (const side of [-1, 1]) {
      box(this.root, [10, .24, 1060], [side * 58, .13, -30], concrete, { receive: true, worldSurface: true });
      box(this.root, [.7, .42, 1060], [side * 52.7, .22, -30], curbMat, { receive: true, worldSurface: true });
    }

    // Instanced drainage grates and reflectors provide human-scale texture.
    const grateGeo = new THREE.BoxGeometry(1.2, .045, .52);
    const grate = new THREE.InstancedMesh(grateGeo, dark, 44);
    const reflectorGeo = new THREE.BoxGeometry(.18, .05, .52);
    const reflectorMat = new THREE.MeshStandardMaterial({ color: 0x8d9eac, emissive: 0x9bb9d0, emissiveIntensity: .35, roughness: .28, metalness: .6 });
    const reflectors = new THREE.InstancedMesh(reflectorGeo, reflectorMat, 90);
    const d = new THREE.Object3D();
    let gi = 0, ri = 0;
    for (let z = 470; z >= -590; z -= 50) {
      for (const side of [-1, 1]) {
        d.position.set(side * 51.8, .235, z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); grate.setMatrixAt(gi++, d.matrix);
      }
      if (ri < 90) {
        d.position.set(-16, .12, z + 12); d.updateMatrix(); reflectors.setMatrixAt(ri++, d.matrix);
        d.position.set(16, .12, z - 11); d.updateMatrix(); reflectors.setMatrixAt(ri++, d.matrix);
      }
    }
    grate.count = gi; reflectors.count = ri;
    grate.castShadow = false; reflectors.castShadow = false;
    this.root.add(grate, reflectors);

    // Street lights: emissive geometry everywhere, real point lights only at hero nodes.
    for (let i = 0; i < 18; i++) {
      const z = 480 - i * 62;
      for (const side of [-1, 1]) {
        const pole = box(this.root, [.18, 7.8, .18], [side * 61.5, 3.9, z], dark, { cast: false, receive: false });
        pole.userData.worldSurface = false;
        box(this.root, [2.3, .14, .18], [side * 60.45, 7.65, z], dark, { cast: false, receive: false });
        box(this.root, [.72, .12, .32], [side * 59.4, 7.55, z], lampMat, { cast: false, receive: false });
        if (i % 6 === 1) {
          const light = new THREE.PointLight(0xa9c9e4, 5.2, 38, 2.1);
          light.position.set(side * 59.4, 7.35, z); light.castShadow = false;
          this.root.add(light);
          this.dynamic.push({ kind: 'pulseLight', light, phase: rng() * 10, base: 4.6, amp: .45 });
        }
      }
    }

    // Broad generated road history layer.
    const decalTex = makeRoadDecalTexture(0xCA2B0A7);
    decalTex.repeat.set(5, 18);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(96, 1120), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, opacity: .72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    decal.rotation.x = -Math.PI / 2; decal.position.set(0, .125, -30); decal.userData.worldSurface = false;
    this.root.add(decal);
  }

  _buildExpanseRoadLayer() {
    const metal = new THREE.MeshStandardMaterial({ color: 0x4d5961, roughness: .54, metalness: .78 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x11171c, roughness: .68, metalness: .52 });
    const marker = new THREE.MeshStandardMaterial({ color: 0xb8c5cf, emissive: 0x70889c, emissiveIntensity: .18, roughness: .42, metalness: .32 });

    // Drainage channels along the highway create speed lines and physical edge definition.
    for (const side of [-1, 1]) {
      box(this.root, [4.8, .42, 2050], [side * 35.5, -.02, -1750], dark, { receive: true });
      box(this.root, [.22, .74, 2050], [side * 38.0, .15, -1750], metal, { receive: true });
    }

    const postGeo = new THREE.BoxGeometry(.16, 1.25, .16);
    const posts = new THREE.InstancedMesh(postGeo, metal, 90);
    const reflectGeo = new THREE.BoxGeometry(.24, .16, .08);
    const reflects = new THREE.InstancedMesh(reflectGeo, marker, 90);
    const d = new THREE.Object3D();
    let n = 0;
    for (let z = -760; z >= -2710; z -= 44) {
      const side = n % 2 ? -1 : 1;
      const x = side * 39.2;
      d.position.set(x, .62, z); d.updateMatrix(); posts.setMatrixAt(n, d.matrix);
      d.position.set(x - side * .10, .82, z - .08); d.updateMatrix(); reflects.setMatrixAt(n, d.matrix);
      n++;
    }
    posts.count = reflects.count = n;
    posts.castShadow = false; reflects.castShadow = false;
    this.root.add(posts, reflects);

    // A few readable infrastructure moments rather than repeated stunt ramps.
    const gantryMat = new THREE.MeshStandardMaterial({ color: 0x202932, roughness: .42, metalness: .84 });
    for (const z of [-1120, -1880, -2520]) {
      for (const side of [-1, 1]) box(this.root, [1.1, 18, 1.1], [side * 33, 9, z], gantryMat, { cast: false });
      box(this.root, [68, 1.2, 1.4], [0, 17.1, z], gantryMat, { cast: false });
      const strip = box(this.root, [24, .18, 1.5], [0, 16.55, z - .05], marker, { cast: false, receive: false });
      strip.userData.worldSurface = false;
    }
  }

  _buildVerticalCanyon() {
    const rng = seeded(0x71C17E12);
    const dark = new THREE.MeshStandardMaterial({ color: 0x080d13, roughness: .30, metalness: .86 });
    const structural = new THREE.MeshStandardMaterial({ color: 0x303b46, roughness: .42, metalness: .82 });
    const pale = new THREE.MeshStandardMaterial({ color: 0x798a98, roughness: .26, metalness: .84 });
    const windowTexA = makeWindowTexture(0x91AA32, '#7f78da');
    const windowTexB = makeWindowTexture(0xA117EE, '#b07c62');
    windowTexA.repeat.set(1, 3); windowTexB.repeat.set(1, 4);
    const winA = new THREE.MeshStandardMaterial({ map: windowTexA, emissiveMap: windowTexA, emissive: 0xb7d8ef, emissiveIntensity: .82, roughness: .18, metalness: .38 });
    const winB = new THREE.MeshStandardMaterial({ map: windowTexB, emissiveMap: windowTexB, emissive: 0x9f8eea, emissiveIntensity: .60, roughness: .19, metalness: .38 });

    // Road-edge buttresses make the lower city read as an architectural canyon.
    const buttresses = [
      [-73, -3195, 44, 95], [73, -3235, 52, 115],
      [-74, -3370, 68, 150], [74, -3425, 74, 175],
      [-72, -3620, 92, 225], [72, -3690, 104, 260]
    ];
    for (let i = 0; i < buttresses.length; i++) {
      const [x, z, w, h] = buttresses[i];
      const side = Math.sign(x);
      box(this.root, [w, h, 42], [x + side * w * .25, h / 2, z], i % 2 ? dark : structural, { cast: false, receive: true, worldSurface: true });
      box(this.root, [.42, h * .78, 34], [x - side * (w * .24), h * .52, z - 1], i % 3 ? winA : winB, { cast: false, receive: false });
      box(this.root, [w * .78, .55, 46], [x + side * w * .22, h * .74, z], pale, { cast: false, receive: false });
      addStaticCollider(this.engine, [w, h, 42], [x + side * w * .25, h / 2, z]);
    }

    // Skybridges and suspended ribs turn verticality into visible city structure.
    const bridges = [
      [92, -3275, 166], [168, -3480, 220], [255, -3705, 300]
    ];
    for (let i = 0; i < bridges.length; i++) {
      const [y, z, span] = bridges[i];
      box(this.root, [span, 7.5, 24], [0, y, z], dark, { cast: false, receive: true, worldSurface: true });
      box(this.root, [span * .84, .42, 26], [0, y + 4.0, z], structural, { cast: false, receive: true, worldSurface: true });
      for (const side of [-1, 1]) box(this.root, [span * .43, .22, 1.2], [side * span * .23, y - 3.15, z - 10.5], side > 0 ? winA : winB, { cast: false, receive: false });
      addStaticCollider(this.engine, [span, 7.5, 24], [0, y, z]);
    }

    // Vertical luminous service rails create scale without flooding the scene with lights.
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1e2431, emissive: 0x756df0, emissiveIntensity: 2.0, roughness: .18, metalness: .45 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const x = side * (118 + i * 54);
        const z = -3190 - i * 105;
        const h = 130 + i * 54;
        box(this.root, [.38, h, .55], [x, h / 2 + 12, z], railMat, { cast: false, receive: false });
      }
    }

    // Sparse local light pools support silhouettes rather than flattening every facade.
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? -1 : 1;
      const light = new THREE.PointLight(i % 3 === 0 ? 0x8d84ff : 0x9fc3dd, 7.5, 92, 2.3);
      light.position.set(side * (55 + (i % 3) * 42), 12 + (i % 4) * 18, -3190 - i * 78);
      light.castShadow = false; this.root.add(light);
      this.dynamic.push({ kind: 'pulseLight', light, phase: rng() * 12, base: 6.7, amp: 1.1 });
    }

    this._buildAerialTraffic(rng);
    this._buildCityLightShafts(rng);
  }

  _buildAerialTraffic(rng) {
    const geo = new THREE.BoxGeometry(3.6, .7, 9.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1c242d, emissive: 0x9dbfdf, emissiveIntensity: 1.45, roughness: .32, metalness: .78 });
    const count = 42;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({
        lane: i % 5,
        side: i % 2 ? -1 : 1,
        phase: rng() * 1,
        speed: .018 + rng() * .028,
        height: 70 + rng() * 520,
        radius: 120 + rng() * 520,
        zBase: -3460 - rng() * 680
      });
    }
    this.root.add(mesh);
    this.dynamic.push({ kind: 'traffic', mesh, items });
  }

  _buildCityLightShafts(rng) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x8ba9c8, transparent: true, opacity: .026, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 11; i++) {
      const h = 110 + rng() * 260;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(7 + rng() * 8, 22 + rng() * 22, h, 12, 1, true), mat.clone());
      shaft.position.set((rng() - .5) * 520, h / 2 + 12, -3210 - rng() * 760);
      shaft.rotation.z = (rng() - .5) * .06;
      shaft.userData.worldSurface = false;
      this.root.add(shaft);
      this.dynamic.push({ kind: 'shaft', mesh: shaft, phase: rng() * 10, base: shaft.material.opacity });
    }
  }

  _buildAtmosphericDepth() {
    const tex = makeSoftDisc();
    const mat = new THREE.SpriteMaterial({ map: tex, color: 0xa9bac8, transparent: true, opacity: .11, depthWrite: false, fog: false });
    const defs = [
      [-800, 120, -1200, 950, 260], [820, 150, -1650, 1100, 300],
      [-920, 190, -2300, 1300, 380], [880, 220, -2700, 1200, 420],
      [-620, 260, -3400, 880, 520], [640, 330, -3900, 920, 620]
    ];
    for (const [x, y, z, sx, sy] of defs) {
      const s = new THREE.Sprite(mat.clone());
      s.position.set(x, y, z); s.scale.set(sx, sy, 1); this.root.add(s);
    }

    // Horizon cards create color extinction before geometry disappears into fog.
    const horizonMat = new THREE.MeshBasicMaterial({ color: 0x203344, transparent: true, opacity: .075, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const z of [-1550, -2650, -3850, -4700]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2600, 520), horizonMat.clone());
      p.position.set(0, 210, z); p.userData.worldSurface = false;
      this.root.add(p);
    }
  }

  update(dt) {
    this._time += dt;
    for (const item of this.dynamic) {
      if (item.kind === 'pulseLight') {
        item.light.intensity = item.base + Math.sin(this._time * .7 + item.phase) * item.amp;
      } else if (item.kind === 'shaft') {
        item.mesh.material.opacity = item.base * (.72 + Math.sin(this._time * .23 + item.phase) * .18);
      } else if (item.kind === 'traffic') {
        const { mesh, items } = item;
        for (let i = 0; i < items.length; i++) {
          const t = items[i];
          const phase = (t.phase + this._time * t.speed) % 1;
          const sweep = phase * 2 - 1;
          const x = t.side * (70 + Math.abs(sweep) * t.radius);
          const z = t.zBase + sweep * 520;
          const y = t.height + Math.sin((phase + t.lane * .17) * Math.PI * 2) * 12;
          this._pos.set(x, y, z);
          this._quat.setFromEuler(new THREE.Euler(0, t.side > 0 ? -.34 : .34, 0));
          this._matrix.compose(this._pos, this._quat, this._scale);
          mesh.setMatrixAt(i, this._matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
