import * as THREE from 'three/webgpu';

function smooth01(t) {
  const v = THREE.MathUtils.clamp(t, 0, 1);
  return v * v * (3 - 2 * v);
}

function heightAt(x, z) {
  // Keep the highway corridor nearly level, then blend into broad driveable
  // terrain. The player should be able to leave the road without discovering
  // that the landscape was only a horizon card.
  const shoulder = smooth01((Math.abs(x) - 62) / 240);
  const macro = Math.sin(x * .012 + z * .0045) * 3.2 + Math.sin(z * .009 - x * .003) * 2.1;
  const longWave = Math.sin(z * .0038 + 1.7) * 2.6;
  const ridge = Math.pow(smooth01((Math.abs(x) - 210) / 520), 1.35) * (8 + Math.abs(Math.sin(z * .0065)) * 8);
  return .045 + shoulder * (2.0 + macro + longWave + ridge);
}

export class ExpanseTerrainSurface {
  constructor(engine) {
    this.engine = engine;
    this.root = new THREE.Group();
    this.root.name = 'Expanse // Driveable Terrain Surface';
    engine.scene.add(this.root);
    this.built = false;
  }

  build() {
    if (this.built) return;
    this.built = true;

    const width = 1500;
    const length = 2200;
    const centerZ = -1710;
    const segX = 34;
    const segZ = 66;
    const cols = segX + 1;
    const rows = segZ + 1;
    const positions = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const indices = new Uint32Array(segX * segZ * 6);

    let vi = 0;
    for (let iz = 0; iz <= segZ; iz++) {
      const z = centerZ + (iz / segZ - .5) * length;
      for (let ix = 0; ix <= segX; ix++) {
        const x = (ix / segX - .5) * width;
        const y = heightAt(x, z);
        positions[vi * 3] = x;
        positions[vi * 3 + 1] = y;
        positions[vi * 3 + 2] = z;

        const h = THREE.MathUtils.clamp(y / 24, 0, 1);
        colors[vi * 3] = .18 + h * .10;
        colors[vi * 3 + 1] = .205 + h * .095;
        colors[vi * 3 + 2] = .19 + h * .065;
        vi++;
      }
    }

    let ii = 0;
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * cols + ix;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        // Winding points normals upward in X/Z space.
        indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
        indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xb4b8ad,
      vertexColors: true,
      roughness: .98,
      metalness: .01,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.worldSurface = true;
    this.root.add(mesh);

    // One static trimesh collider uses the exact same vertices as the visible
    // terrain. This is intentionally moderate resolution: enough for bike-scale
    // slopes without turning the physics scene into a terrain-authoring benchmark.
    const { RAPIER, world } = this.engine;
    try {
      const collider = RAPIER.ColliderDesc.trimesh(positions, indices);
      world.createCollider(collider);
    } catch (err) {
      console.warn('[Apex] Expanse terrain trimesh unavailable; visual terrain remains active.', err);
    }
  }
}
