import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function rounded(size, mat, radius = .12, segments = 3) {
  const r = Math.min(radius, ...size.map((v) => Math.max(.01, v * .17)));
  return new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segments, r), mat);
}

export class BikeWorldEnhancements {
  constructor(engine, mats) {
    this.engine = engine;
    this.mats = mats;
    this.group = new THREE.Group();
    this.group.name = 'Bike World Enhancements';
    this.engine.scene.add(this.group);
    this.built = false;
  }

  build() {
    if (this.built) return;
    this.built = true;

    // Secondary catch slabs sit just under the visible world floor. They are not
    // intended as traversal surfaces; they simply prevent high-speed character-
    // controller misses from turning into an endless under-world fall.
    this._addSafetySlab(0, -3900, 2500, 3000);
    this._addSafetySlab(0, -1800, 1800, 2100);

    const ramps = [
      { x: 0, z: -760,  w: 22, l: 44, a: .16 },
      { x: -88, z: -1120, w: 16, l: 34, a: .22 },
      { x: 94, z: -1435, w: 17, l: 38, a: .24 },
      { x: 0, z: -1815, w: 30, l: 56, a: .20 },
      { x: -118, z: -2190, w: 22, l: 46, a: .25 },
      { x: 112, z: -2490, w: 20, l: 42, a: .27 },
      { x: 0, z: -2860, w: 36, l: 62, a: .19 },
      { x: -132, z: -3225, w: 24, l: 48, a: .26 },
      { x: 136, z: -3405, w: 24, l: 50, a: .28 }
    ];
    ramps.forEach((def, i) => this._addRamp(def, i));

    // Large readable landing strips reward experimentation without turning the
    // whole world into a stunt park. They also make jump lines visible at speed.
    [
      [0, -850, 36], [-88, -1210, 28], [94, -1535, 28], [0, -1950, 48],
      [-118, -2300, 34], [112, -2600, 34], [0, -3010, 54], [-132, -3345, 36], [136, -3525, 36]
    ].forEach(([x, z, w]) => this._addLandingStrip(x, z, w));
  }

  _addSafetySlab(x, z, width, length) {
    const { world, RAPIER } = this.engine;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, 3, length / 2)
        .setTranslation(x, -3.15, z)
    );
  }

  _addRamp({ x, z, w, l, a }, index) {
    const { world, RAPIER } = this.engine;
    const y = .32 + Math.sin(a) * l * .5;
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.x = a;
    this.group.add(root);

    const deck = rounded([w, .70, l], this.mats.scarredMetal, .14, 3);
    deck.userData.worldSurface = true;
    deck.receiveShadow = true;
    root.add(deck);

    const surface = rounded([w * .90, .12, l * .96], this.mats.floorWorn, .05, 2);
    surface.position.y = .40;
    surface.userData.worldSurface = true;
    root.add(surface);

    for (const side of [-1, 1]) {
      const rail = rounded([.22, .52, l * .94], this.mats.paleMetal, .045, 2);
      rail.position.set(side * w * .46, .62, 0);
      rail.userData.worldSurface = false;
      root.add(rail);

      const spectral = rounded([.055, .08, l * .82], this.mats.spectral, .015, 2);
      spectral.position.set(side * w * .34, .50, -.5);
      spectral.userData.worldSurface = false;
      root.add(spectral);
    }

    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, .48, l / 2)
        .setTranslation(x, y, z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );

    // Sparse overhead markers make the best jump lines readable from a bike
    // without painting giant arcade arrows onto the environment.
    if (index === 3 || index === 6) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(w * .44, .18, 8, 28, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x8f86ff, transparent: true, opacity: .36, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      arch.position.set(x, y + 7.5, z - l * .32);
      arch.rotation.set(0, 0, Math.PI);
      arch.userData.worldSurface = false;
      this.group.add(arch);
    }
  }

  _addLandingStrip(x, z, width) {
    const strip = rounded([width, .025, 5.5], this.mats.spectral, .01, 2);
    strip.position.set(x, .13, z);
    strip.material = strip.material.clone();
    strip.material.transparent = true;
    strip.material.opacity = .32;
    strip.userData.worldSurface = false;
    this.group.add(strip);
  }
}
