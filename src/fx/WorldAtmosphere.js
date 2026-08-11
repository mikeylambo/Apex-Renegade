import * as THREE from 'three/webgpu';

function radialTexture(inner, mid, outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner); g.addColorStop(.2, mid); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function makeSkyTexture() {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 768;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 768);
  g.addColorStop(0, '#010308'); g.addColorStop(.34, '#050a11'); g.addColorStop(.62, '#0c1520'); g.addColorStop(.82, '#18232d'); g.addColorStop(1, '#2a3037');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 430; i++) {
    const px = Math.random() * c.width, py = Math.random() * 330, a = .09 + Math.random() * .48;
    x.fillStyle = `rgba(205,221,239,${a})`;
    const s = .35 + Math.random() * .95;
    x.fillRect(px, py, s, s);
  }
  for (let i = 0; i < 42; i++) {
    const px = Math.random() * c.width, w = .4 + Math.random() * 1.6, top = 70 + Math.random() * 270, len = 40 + Math.random() * 180;
    const q = x.createLinearGradient(0, top, 0, top + len);
    q.addColorStop(0, 'rgba(120,135,175,0)');
    q.addColorStop(.5, `rgba(130,145,190,${.015 + Math.random() * .025})`);
    q.addColorStop(1, 'rgba(120,135,175,0)');
    x.fillStyle = q; x.fillRect(px, top, w, len);
  }
  return new THREE.CanvasTexture(c);
}

function makeCloudTexture() {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 768;
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < 190; i++) {
    const px = Math.random() * c.width, py = 280 + Math.random() * 460, rx = 90 + Math.random() * 360, ry = 24 + Math.random() * 90;
    const q = x.createRadialGradient(px, py, 0, px, py, rx);
    const a = .032 + Math.random() * .075;
    q.addColorStop(0, `rgba(${55 + Math.random() * 20},${68 + Math.random() * 25},${92 + Math.random() * 30},${a})`);
    q.addColorStop(.55, `rgba(35,47,65,${a * .55})`);
    q.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(px, py); x.scale(1, ry / rx); x.fillStyle = q; x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore();
  }
  return new THREE.CanvasTexture(c);
}

function makeFractureTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'); x.clearRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(150,145,225,.42)'; x.lineWidth = 1.25;
  for (let i = 0; i < 24; i++) {
    let px = 256 + (Math.random() - .5) * 70, py = 256 + (Math.random() - .5) * 70;
    x.beginPath(); x.moveTo(px, py);
    for (let j = 0; j < 10; j++) { px += (Math.random() - .5) * 42; py += (Math.random() - .5) * 42; x.lineTo(px, py); }
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}

export class WorldAtmosphere {
  constructor(engine) {
    this.engine = engine;
    this.skyGroup = new THREE.Group();
    this.landmarkGroup = new THREE.Group();
    this._driftTime = 0;
    engine.scene.add(this.skyGroup, this.landmarkGroup);

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(6800, 56, 32),
      new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
    );
    this.skyGroup.add(this.sky);

    this.cloudDome = new THREE.Mesh(
      new THREE.SphereGeometry(6600, 56, 32),
      new THREE.MeshBasicMaterial({ map: makeCloudTexture(), side: THREE.BackSide, transparent: true, opacity: .9, depthWrite: false, fog: false })
    );
    this.cloudDome.rotation.y = .5;
    this.skyGroup.add(this.cloudDome);

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(230, 40, 28),
      new THREE.MeshStandardMaterial({ color: 0x737d88, roughness: .96, metalness: 0, emissive: 0x152032, emissiveIntensity: .12 })
    );
    body.position.set(-1450, 980, -5600);
    this.landmarkGroup.add(body);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa2afc0, transparent: true, opacity: .055, depthWrite: false });
    for (const [r, t, rot] of [[300, 2.1, [.55, .2, .2]], [360, 1.0, [.15, .75, .1]], [420, .58, [.8, .2, .7]]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 128), ringMat.clone());
      ring.position.copy(body.position); ring.rotation.set(...rot); this.landmarkGroup.add(ring);
    }

    const fracture = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeFractureTexture(), color: 0x8278d8, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    fracture.position.set(-1320, 870, -5230); fracture.scale.set(520, 520, 1); this.landmarkGroup.add(fracture);

    this.pressureRings = [];
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: i === 2 ? 0x796fe0 : 0x91a0b5, transparent: true, opacity: i === 2 ? .037 : .020, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(520 + i * 72, .55 + i * .12, 6, 160, Math.PI * 1.18), mat);
      ring.position.set(-760, 720, -5000 - i * 70);
      ring.rotation.set(.75, .32, -.35 + i * .11);
      this.landmarkGroup.add(ring);
      this.pressureRings.push(ring);
    }

    const tex = radialTexture('rgba(225,235,247,1)', 'rgba(110,127,154,.30)');
    const count = 1800, geo = new THREE.BufferGeometry(), p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - .5) * 1800;
      p[i * 3 + 1] = Math.random() * 260 - 40;
      p[i * 3 + 2] = (Math.random() - .5) * 1800;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.drift = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: .12, color: 0xc5d2e7, transparent: true, opacity: .18, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.skyGroup.add(this.drift);

    this.haze = [];
    const hazeTex = radialTexture('rgba(155,175,198,.24)', 'rgba(66,82,102,.10)');
    for (let i = 0; i < 30; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: hazeTex, transparent: true, opacity: .11, depthWrite: false, fog: false }));
      const a = i / 30 * Math.PI * 2, d = 280 + Math.random() * 650;
      s.position.set(Math.cos(a) * d, 25 + Math.random() * 120, Math.sin(a) * d);
      s.scale.set(220 + Math.random() * 480, 70 + Math.random() * 170, 1);
      this.skyGroup.add(s); this.haze.push(s);
    }
  }

  update(dt) {
    const cam = this.engine.camera.position;
    this._driftTime += dt;
    // Move the atmospheric field as a whole instead of rewriting 1,800 vertex
    // positions on the CPU every frame. The perceived motion is the same at
    // gameplay scale and removes a persistent main-thread cost.
    this.skyGroup.position.set(cam.x, 0, cam.z);
    this.cloudDome.rotation.y += dt * .0011;
    this.sky.rotation.y += dt * .00006;
    this.drift.rotation.y += dt * .0018;
    this.drift.position.x = Math.sin(this._driftTime * .055) * 26;
    this.drift.position.y = Math.sin(this._driftTime * .12) * 6;
    this.drift.position.z = Math.cos(this._driftTime * .041) * 18;
    for (let i = 0; i < this.pressureRings.length; i++) this.pressureRings[i].rotation.z += dt * (i % 2 ? -.0009 : .00065);
  }
}
