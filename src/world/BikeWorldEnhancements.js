import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VisualCeilingWorld } from './VisualCeilingWorld.js';
import { VisualCeilingWorldII } from './VisualCeilingWorldII.js';

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
    this.visualCeiling = null;
    this.visualCeilingII = null;
  }

  build() {
    if (this.built) return;
    this.built = true;

    // Secondary catch slabs sit just under the visible world floor. They are not
    // intended as traversal surfaces; they simply prevent high-speed character-
    // controller misses from turning into an endless under-world fall.
    this._addSafetySlab(0, -3900, 2500, 3000);
    this._addSafetySlab(0, -1800, 1800, 2100);

    // Keep only a handful of deliberate geographic jump opportunities. The bike
    // should read terrain rather than constantly behaving like a stunt vehicle.
    const ramps = [
      { x: 0, z: -1815, w: 30, l: 56, a: .12 },
      { x: -118, z: -2190, w: 22, l: 46, a: .14 },
      { x: 0, z: -2860, w: 36, l: 62, a: .13 }
    ];
    ramps.forEach((def) => this._addRamp(def));

    // Visual Ceiling I: generated textures, facade information, atmosphere and
    // world dressing. Visual Ceiling II: terrain relief, city-canyon hierarchy,
    // local light pools, aerial traffic and denser infrastructure. No imported art.
    this.visualCeiling = new VisualCeilingWorld(this.engine, this.mats);
    this.visualCeiling.build();
    this.visualCeilingII = new VisualCeilingWorldII(this.engine, this.mats);
    this.visualCeilingII.build();
  }

  _addSafetySlab(x, z, width, length) {
    const { world, RAPIER } = this.engine;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, 3, length / 2)
        .setTranslation(x, -3.15, z)
    );
  }

  _addRamp({ x, z, w, l, a }) {
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
  }
}
