import * as THREE from 'three/webgpu';

/**
 * TODO(content): this area is intentionally a light stub to prove out
 * LevelManager's progression seam (graveyard -> cathedral -> ...). Give it
 * real geometry, a unique visual hook, and its own boss (see arena_graveyard's
 * bossDef shape) when you're ready to expand past the vertical slice.
 */
const SIZE = 30;

export const CathedralLevel = {
  id: 'cathedral',
  name: 'The Sunken Cathedral',
  playerStart: new THREE.Vector3(0, 2, 10),

  build(engine) {
    const { scene, world, RAPIER } = engine;
    const group = new THREE.Group();
    scene.add(group);

    const ambient = new THREE.AmbientLight(0x1a2440, 1.0);
    const key = new THREE.DirectionalLight(0x6a8aff, 1.1);
    key.position.set(10, 22, -6);
    key.castShadow = true;
    group.add(ambient, key);

    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.9 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(SIZE / 2, 0.1, SIZE / 2).setTranslation(0, -0.1, 0));

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x080c14, roughness: 1 });
    const wallDefs = [
      { pos: [0, 3, SIZE / 2], size: [SIZE, 6, 1] },
      { pos: [0, 3, -SIZE / 2], size: [SIZE, 6, 1] },
      { pos: [SIZE / 2, 3, 0], size: [1, 6, SIZE] },
      { pos: [-SIZE / 2, 3, 0], size: [1, 6, SIZE] }
    ];
    for (const w of wallDefs) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
      mesh.position.set(...w.pos);
      group.add(mesh);
      world.createCollider(RAPIER.ColliderDesc.cuboid(w.size[0] / 2, w.size[1] / 2, w.size[2] / 2).setTranslation(...w.pos));
    }

    const spawnPoints = [
      new THREE.Vector3(12, 1, 12), new THREE.Vector3(-12, 1, 12),
      new THREE.Vector3(12, 1, -12), new THREE.Vector3(-12, 1, -12)
    ];
    const pickupSpots = [
      { type: 'health', pos: new THREE.Vector3(0, 0, 0) },
      { type: 'ammo', pos: new THREE.Vector3(6, 0, -6) }
    ];
    const waveDefs = [
      { composition: [{ type: 'hollow', count: 6 }, { type: 'enforcer', count: 2 }] },
      { composition: [{ type: 'hollow', count: 8 }, { type: 'enforcer', count: 3 }] }
    ];

    return { group, spawnPoints, pickupSpots, waveDefs, bossDef: null };
  }
};
