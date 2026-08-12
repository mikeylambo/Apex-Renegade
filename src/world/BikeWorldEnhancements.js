import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VisualCeilingWorld } from './VisualCeilingWorld.js';
import { VisualCeilingWorldIII } from './VisualCeilingWorldIII.js';
import { VisualCeilingWorldIV } from './VisualCeilingWorldIV.js';

function rounded(size, mat, radius = .12, segments = 3) {
  const r = Math.min(radius, ...size.map((v) => Math.max(.01, v * .17)));
  return new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segments, r), mat);
}

function smooth01(t) { return t * t * (3 - 2 * t); }

export class BikeWorldEnhancements {
  constructor(engine, mats) {
    this.engine = engine;
    this.mats = mats;
    this.group = new THREE.Group();
    this.group.name = 'Bike World Enhancements';
    this.engine.scene.add(this.group);
    this.built = false;
    this.visualCeiling = null;
    this.visualCeilingIII = null;
    this.visualCeilingIV = null;
  }

  build() {
    if (this.built) return;
    this.built = true;

    // Catch coverage now spans Scar + Expanse + Vertical Megacity. The previous
    // two slabs left the opening Scar boulevard without the same safety net.
    this._addSafetySlab(0, -40, 1900, 1550);
    this._addSafetySlab(0, -1800, 1800, 2100);
    this._addSafetySlab(0, -3900, 2500, 3000);

    const ramps = [
      { x: 0, z: -1815, w: 30, l: 64, rise: 5.4 },
      { x: -118, z: -2190, w: 22, l: 54, rise: 5.1 },
      { x: 0, z: -2860, w: 36, l: 70, rise: 6.0 }
    ];
    ramps.forEach((def) => this._addBlendedRamp(def));

    // Ceiling II remains in the repository as a useful experiment, but it is no
    // longer stacked live. III already supersedes much of its close/mid detail and
    // IV replaces its horizon job with a cheaper, more deliberate proxy layer.
    this.visualCeiling = new VisualCeilingWorld(this.engine, this.mats);
    this.visualCeiling.build();
    this.visualCeilingIII = new VisualCeilingWorldIII(this.engine, this.mats);
    this.visualCeilingIII.build();
    this.visualCeilingIV = new VisualCeilingWorldIV(this.engine);
    this.visualCeilingIV.build();
  }

  _addSafetySlab(x, z, width, length) {
    const { world, RAPIER } = this.engine;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, 3, length / 2)
        .setTranslation(x, -3.15, z)
    );
  }

  _addBlendedRamp({ x, z, w, l, rise }) {
    const { world, RAPIER } = this.engine;
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    this.group.add(root);

    // Twelve shallow segments instead of nine steeper ones. Each segment blends
    // into the next and the total rise is lower, so these read as broken road / 
    // embankment geometry rather than stunt ramps.
    const pieces = 12;
    const segL = l / pieces;
    for (let i = 0; i < pieces; i++) {
      const t0 = i / pieces, t1 = (i + 1) / pieces;
      const h0 = smooth01(t0) * rise;
      const h1 = smooth01(t1) * rise;
      const h = (h0 + h1) * .5;
      const slope = Math.atan2(h1 - h0, segL);
      const localZ = l * .5 - (i + .5) * segL;

      const deck = rounded([w, .54, segL + .22], this.mats.scarredMetal, .09, 2);
      deck.position.set(0, h + .27, localZ);
      deck.rotation.x = slope;
      deck.receiveShadow = true;
      deck.userData.worldSurface = true;
      root.add(deck);

      const surface = rounded([w * .91, .085, segL + .10], this.mats.floorWorn, .03, 2);
      surface.position.set(0, h + .585, localZ);
      surface.rotation.x = slope;
      surface.userData.worldSurface = true;
      root.add(surface);

      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), slope);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, .37, (segL + .20) / 2)
          .setTranslation(x, h + .285, z + localZ)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      );
    }

    for (const side of [-1, 1]) {
      for (let i = 0; i < pieces; i++) {
        const t0 = i / pieces, t1 = (i + 1) / pieces;
        const h0 = smooth01(t0) * rise, h1 = smooth01(t1) * rise;
        const h = (h0 + h1) * .5, slope = Math.atan2(h1 - h0, segL);
        const localZ = l * .5 - (i + .5) * segL;
        const rail = rounded([.14, .28, segL + .10], this.mats.paleMetal, .025, 2);
        rail.position.set(side * w * .46, h + .82, localZ);
        rail.rotation.x = slope;
        rail.userData.worldSurface = false;
        root.add(rail);
      }
    }
  }
}
