import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VisualCeilingWorld } from './VisualCeilingWorld.js';
import { VisualCeilingWorldII } from './VisualCeilingWorldII.js';
import { VisualCeilingWorldIII } from './VisualCeilingWorldIII.js';

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
    this.visualCeilingII = null;
    this.visualCeilingIII = null;
  }

  build() {
    if (this.built) return;
    this.built = true;

    this._addSafetySlab(0, -3900, 2500, 3000);
    this._addSafetySlab(0, -1800, 1800, 2100);

    // Deliberate geographic jump opportunities only. Each ramp is now a smooth
    // eased profile made from short physical segments, so the bike climbs into
    // the launch instead of striking the edge of one rotated slab.
    const ramps = [
      { x: 0, z: -1815, w: 30, l: 60, rise: 6.2 },
      { x: -118, z: -2190, w: 22, l: 50, rise: 6.0 },
      { x: 0, z: -2860, w: 36, l: 66, rise: 7.0 }
    ];
    ramps.forEach((def) => this._addBlendedRamp(def));

    this.visualCeiling = new VisualCeilingWorld(this.engine, this.mats);
    this.visualCeiling.build();
    this.visualCeilingII = new VisualCeilingWorldII(this.engine, this.mats);
    this.visualCeilingII.build();
    this.visualCeilingIII = new VisualCeilingWorldIII(this.engine, this.mats);
    this.visualCeilingIII.build();
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

    const pieces = 9;
    const segL = l / pieces;
    for (let i = 0; i < pieces; i++) {
      const t0 = i / pieces, t1 = (i + 1) / pieces, tm = (t0 + t1) * .5;
      const h0 = smooth01(t0) * rise;
      const h1 = smooth01(t1) * rise;
      const h = (h0 + h1) * .5;
      const slope = Math.atan2(h1 - h0, segL);
      // The route travels toward negative Z; positive X-axis rotation raises the
      // negative-Z end of each segment.
      const localZ = l * .5 - (i + .5) * segL;

      const deck = rounded([w, .58, segL + .24], this.mats.scarredMetal, .10, 2);
      deck.position.set(0, h + .28, localZ);
      deck.rotation.x = slope;
      deck.receiveShadow = true;
      deck.userData.worldSurface = true;
      root.add(deck);

      const surface = rounded([w * .90, .10, segL + .12], this.mats.floorWorn, .035, 2);
      surface.position.set(0, h + .62, localZ);
      surface.rotation.x = slope;
      surface.userData.worldSurface = true;
      root.add(surface);

      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), slope);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, .40, (segL + .22) / 2)
          .setTranslation(x, h + .30, z + localZ)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      );
    }

    // Rails follow a matching eased polyline in short segments. They remain low
    // enough not to visually turn the ramp into a stunt-park object.
    for (const side of [-1, 1]) {
      for (let i = 0; i < pieces; i++) {
        const t0 = i / pieces, t1 = (i + 1) / pieces;
        const h0 = smooth01(t0) * rise, h1 = smooth01(t1) * rise;
        const h = (h0 + h1) * .5, slope = Math.atan2(h1 - h0, segL);
        const localZ = l * .5 - (i + .5) * segL;
        const rail = rounded([.16, .34, segL + .12], this.mats.paleMetal, .03, 2);
        rail.position.set(side * w * .46, h + .90, localZ); rail.rotation.x = slope; rail.userData.worldSurface = false; root.add(rail);
      }
    }
  }
}
