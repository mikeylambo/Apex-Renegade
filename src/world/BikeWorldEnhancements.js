import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VisualCeilingWorld } from './VisualCeilingWorld.js';
import { VisualCeilingWorldIII } from './VisualCeilingWorldIII.js';
import { VisualCeilingWorldIV } from './VisualCeilingWorldIV.js';
import { ExpanseTerrainSurface } from './ExpanseTerrainSurface.js';

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
    this.expanseTerrain = null;
  }

  build() {
    if (this.built) return;
    this.built = true;

    this._addSafetySlab(0, -40, 1900, 1550);
    this._addSafetySlab(0, -1800, 1800, 2100);
    this._addSafetySlab(0, -3900, 2500, 3000);

    // The Expanse now has a real visible + physical terrain surface rather than
    // asking the player to respect scenery that was never meant to be reached.
    this.expanseTerrain = new ExpanseTerrainSurface(this.engine);
    this.expanseTerrain.build();

    const ramps = [
      { x: 0, z: -1815, w: 30, l: 68, rise: 4.7 },
      { x: -118, z: -2190, w: 22, l: 58, rise: 4.4 },
      { x: 0, z: -2860, w: 36, l: 74, rise: 5.0 }
    ];
    ramps.forEach((def) => this._addBlendedRamp(def));

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

    // Keep the first centimeter of the ramp at road height. The previous ramp
    // stacked a thick deck + visual surface above the road, creating a curb-like
    // lip that the kinematic bike could hit instead of climbing.
    const pieces = 14;
    const segL = l / pieces;
    const roadY = .12;
    const thickness = .16;

    for (let i = 0; i < pieces; i++) {
      const t0 = i / pieces, t1 = (i + 1) / pieces;
      const h0 = smooth01(t0) * rise;
      const h1 = smooth01(t1) * rise;
      const topH = (h0 + h1) * .5;
      const slope = Math.atan2(h1 - h0, segL);
      const localZ = l * .5 - (i + .5) * segL;
      const topY = roadY + topH;

      const deck = rounded([w, thickness, segL + .30], this.mats.floorWorn, .035, 2);
      deck.position.set(0, topY - thickness * .5, localZ);
      deck.rotation.x = slope;
      deck.receiveShadow = true;
      deck.userData.worldSurface = true;
      root.add(deck);

      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), slope);
      const colliderHalfH = .10;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, colliderHalfH, (segL + .28) / 2)
          .setTranslation(x, topY - colliderHalfH, z + localZ)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      );
    }

    // Rails begin after the entry blend so nothing at the ramp mouth can act as
    // an accidental collision lip.
    for (const side of [-1, 1]) {
      for (let i = 2; i < pieces; i++) {
        const t0 = i / pieces, t1 = (i + 1) / pieces;
        const h0 = smooth01(t0) * rise, h1 = smooth01(t1) * rise;
        const h = (h0 + h1) * .5, slope = Math.atan2(h1 - h0, segL);
        const localZ = l * .5 - (i + .5) * segL;
        const rail = rounded([.12, .22, segL + .10], this.mats.paleMetal, .02, 2);
        rail.position.set(side * w * .47, roadY + h + .20, localZ);
        rail.rotation.x = slope;
        rail.userData.worldSurface = false;
        root.add(rail);
      }
    }
  }
}
