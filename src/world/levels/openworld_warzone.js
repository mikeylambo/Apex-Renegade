import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createProceduralMaterials } from '../ProceduralMaterials.js';

const WORLD_HALF = 720;

function rounded(group, size, pos, mat, opts = {}) {
  const radius = Math.min(opts.radius ?? .18, ...size.map((v) => v * .18));
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], opts.segments ?? 2, radius), mat);
  mesh.position.set(...pos);
  if (opts.rotation) mesh.rotation.set(...opts.rotation);
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  mesh.userData.worldSurface = opts.worldSurface ?? true;
  group.add(mesh);
  return mesh;
}

function addCollider(world, RAPIER, size, pos, rotationY = 0) {
  const desc = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...pos);
  if (rotationY) desc.setRotation({ x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) });
  world.createCollider(desc);
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function addMegablock(group, world, RAPIER, mats, x, z, w, d, h, variant = 0, collide = true) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  group.add(root);

  rounded(root, [w, h, d], [0, h / 2, 0], variant % 3 === 0 ? mats.blackStone : mats.composite, { radius: .7, segments: 3 });
  rounded(root, [w * .88, h * .92, d + .45], [0, h * .48, -.08], mats.blackMetal, { radius: .45, cast: false });

  const ribs = Math.max(3, Math.floor(w / 10));
  for (let i = 0; i <= ribs; i++) {
    const px = -w * .43 + (i / ribs) * w * .86;
    rounded(root, [.34, h * .82, d + .58], [px, h * .48, -.12], i % 4 === 0 ? mats.paleMetal : mats.metal, { radius: .05, cast: false });
  }
  const decks = Math.max(4, Math.floor(h / 18));
  for (let j = 1; j < decks; j++) {
    rounded(root, [w * .94, .34, d + .66], [0, (j / decks) * h, -.16], mats.scarredMetal, { radius: .06, cast: false });
  }
  if (variant % 2 === 0) {
    rounded(root, [.18, h * .24, d + .72], [w * .34, h * .63, -.18], mats.spectral, { radius: .03, cast: false });
  }

  // Huge readable roof silhouettes instead of dense small-detail clutter.
  if (variant % 3 === 1) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(w * .26, h * .16, 4), mats.blackStone);
    crown.position.y = h + h * .07; crown.rotation.y = Math.PI / 4; crown.userData.worldSurface = false; root.add(crown);
  } else {
    rounded(root, [w * .42, h * .09, d * .56], [0, h + h * .045, 0], mats.scarredMetal, { radius: .24 });
  }

  if (collide) addCollider(world, RAPIER, [w, h, d], [x, h / 2, z]);
  return root;
}

function addRoad(group, mats, x, z, w, l, rot = 0) {
  const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = rot; group.add(root);
  rounded(root, [w, .12, l], [0, .015, 0], mats.floorWorn, { radius: .10, cast: false });
  for (let lane = -2; lane <= 2; lane++) {
    rounded(root, [.11, .018, l * .94], [lane * (w / 6), .085, 0], lane === 0 ? mats.neutralLight : mats.scarredMetal, { radius: .008, cast: false, worldSurface: false });
  }
  for (let z0 = -l * .42; z0 < l * .42; z0 += 28) {
    rounded(root, [w * .78, .02, .15], [0, .09, z0], mats.paleMetal, { radius: .01, cast: false, worldSurface: false });
  }
}

function addOverpass(group, world, RAPIER, mats, x, y, z, length, rot = 0) {
  const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = rot; group.add(root);
  rounded(root, [18, 1.2, length], [0, 0, 0], mats.scarredMetal, { radius: .22 });
  rounded(root, [16.5, .30, length * .96], [0, .72, 0], mats.floorWorn, { radius: .10 });
  for (const s of [-1, 1]) rounded(root, [.28, 1.2, length], [s * 8.3, 1.15, 0], mats.paleMetal, { radius: .06 });
  for (let zz = -length * .4; zz <= length * .4; zz += 44) {
    rounded(root, [2.6, y, 2.6], [0, -y / 2, zz], mats.blackStone, { radius: .20 });
  }
  // One simplified collider keeps the bridge usable without exploding physics cost.
  addCollider(world, RAPIER, [18, 1.4, length], [x, y, z], rot);
}

function addIndustrialField(group, world, RAPIER, mats, rng) {
  const baseX = -270, baseZ = -80;
  for (let i = 0; i < 10; i++) {
    const x = baseX + (i % 5) * 42 + (rng() - .5) * 8;
    const z = baseZ + Math.floor(i / 5) * 72 + (rng() - .5) * 10;
    const h = 26 + rng() * 42;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, h, 16), i % 3 === 0 ? mats.scarredMetal : mats.blackMetal);
    tank.position.set(x, h / 2, z); tank.castShadow = true; tank.receiveShadow = true; tank.userData.worldSurface = true; group.add(tank);
    addCollider(world, RAPIER, [22, h, 22], [x, h / 2, z]);
    for (let r = 0; r < 4; r++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(12.4, .22, 8, 36), mats.paleMetal);
      band.position.set(x, (r + 1) * h / 5, z); band.rotation.x = Math.PI / 2; band.userData.worldSurface = false; group.add(band);
    }
  }
  for (let i = 0; i < 7; i++) {
    const x = baseX - 38 + i * 48;
    rounded(group, [38, 2, 3.2], [x, 17 + (i % 2) * 9, baseZ + 116], mats.metal, { radius: .18, rotation: [0, 0, (i % 2 ? .04 : -.03)] });
  }
}

function addContainmentSpine(group, mats) {
  // Kilometer-scale visual anchor: visible from countryside, city and airspace.
  const root = new THREE.Group(); root.position.set(0, 205, -625); root.rotation.x = -.07; group.add(root);
  for (const [radius, tube, arc, rz, mat] of [
    [128, 3.4, Math.PI * 1.52, .12, mats.blackMetal],
    [111, 1.5, Math.PI * 1.38, -.35, mats.paleMetal],
    [92, .85, Math.PI * 1.23, .58, mats.spectral]
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 160, arc), mat);
    ring.rotation.z = rz; ring.userData.worldSurface = false; root.add(ring);
  }
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    const r = 118;
    const spine = rounded(root, [4.5, 27, 7], [Math.cos(a) * r, Math.sin(a) * r, 0], i % 5 === 0 ? mats.repairMetal : mats.scarredMetal, { radius: .6, cast: false, receive: false, worldSurface: false });
    spine.rotation.z = a - Math.PI / 2;
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x7269da, transparent: true, opacity: .055, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 16, 390, 24, 1, true), beamMat); beam.position.y = -40; beam.userData.worldSurface = false; root.add(beam);
}

function addOpenBasin(group, mats) {
  // SotC-style negative space to the east of the city.
  const basinMat = new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: .96, metalness: .02 });
  const basin = new THREE.Mesh(new THREE.CircleGeometry(230, 56), basinMat);
  basin.position.set(270, .06, 170); basin.rotation.x = -Math.PI / 2; basin.scale.set(1.45, .72, 1); basin.receiveShadow = true; basin.userData.worldSurface = true; group.add(basin);
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2;
    const r = 165 + (i % 3) * 18;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(11 + (i % 4) * 6, 0), i % 3 === 0 ? mats.stone : mats.blackStone);
    rock.position.set(270 + Math.cos(a) * r * 1.25, 7 + (i % 4) * 4, 170 + Math.sin(a) * r * .68);
    rock.scale.set(1.2, 1.6 + (i % 3) * .5, 1.0); rock.rotation.set(i * .13, i * .42, i * .07); rock.castShadow = true; rock.userData.worldSurface = true; group.add(rock);
  }
}

export const OpenWorldWarzoneLevel = {
  id: 'scar_outskirts',
  name: 'THE SCAR OUTSKIRTS // OPEN WAR SANDBOX',
  playerStart: new THREE.Vector3(0, 2.5, 315),
  build(engine) {
    const { scene, world, RAPIER } = engine;
    const group = new THREE.Group(); scene.add(group);
    const mats = createProceduralMaterials();
    const rng = seeded(0xA6E9D3);

    // Open-world visibility and scale.
    scene.fog = new THREE.FogExp2(0x0a1119, .00145);
    engine.camera.far = 2400;
    engine.camera.updateProjectionMatrix();

    const hemi = new THREE.HemisphereLight(0xb9cadc, 0x12161c, .62); group.add(hemi);
    const sun = new THREE.DirectionalLight(0xd9e6f0, 2.25); sun.position.set(-180, 280, 140); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -260; sun.shadow.camera.right = 260; sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260; sun.shadow.camera.far = 700; group.add(sun);
    const rim = new THREE.DirectionalLight(0x657b99, .72); rim.position.set(260, 100, -380); group.add(rim);

    // Ground: one huge physical surface, deliberately sparse outside the city.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2), mats.floorWorn);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.worldSurface = true; group.add(ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(WORLD_HALF, .2, WORLD_HALF).setTranslation(0, -.2, 0));

    // The main north/south super-arterial is wide enough for army columns.
    addRoad(group, mats, 0, -60, 92, 820, 0);
    addRoad(group, mats, -205, 20, 54, 520, Math.PI / 2);
    addRoad(group, mats, 220, -70, 46, 430, Math.PI / 2);

    // Starting-country negative space and monumental gateway into the city.
    for (const s of [-1, 1]) {
      rounded(group, [10, 72, 14], [s * 58, 36, 185], mats.blackStone, { radius: .8 });
      rounded(group, [5, 62, 15], [s * 58, 36, 184], mats.metal, { radius: .4 });
      addCollider(world, RAPIER, [10, 72, 14], [s * 58, 36, 185]);
    }
    rounded(group, [126, 5, 15], [0, 62, 185], mats.scarredMetal, { radius: .5 });

    // Armored-Core-like megablocks: fewer buildings, much larger footprints and setbacks.
    const blocks = [
      [-94, 92, 54, 64, 86, 0], [98, 82, 62, 70, 112, 1],
      [-132, -28, 72, 76, 148, 2], [126, -42, 66, 82, 132, 3],
      [-102, -176, 82, 74, 174, 4], [112, -192, 76, 82, 156, 5],
      [-154, -322, 104, 96, 204, 6], [150, -332, 96, 90, 188, 7]
    ];
    for (const [x, z, w, d, h, v] of blocks) addMegablock(group, world, RAPIER, mats, x, z, w, d, h, v, Math.abs(z) < 240);

    // Secondary skyline set back from the combat lanes; visual, not physics-heavy.
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (215 + rng() * 185);
      const z = 130 - Math.floor(i / 2) * 55 + (rng() - .5) * 30;
      const w = 32 + rng() * 42, d = 34 + rng() * 48, h = 80 + rng() * 180;
      addMegablock(group, world, RAPIER, mats, x, z, w, d, h, i + 9, false);
    }

    // Civic war-plaza — hundreds can be visible here without spatial nonsense.
    rounded(group, [210, .18, 142], [0, .12, -92], mats.floor, { radius: 1.0, cast: false });
    for (let x = -78; x <= 78; x += 26) {
      rounded(group, [9, 1.6, 19], [x, .85, -92 + (Math.abs(x / 26) % 2) * 30], mats.scarredMetal, { radius: .22 });
    }

    // Overpasses preserve Just-Cause-like route topology and give future aerial fighting layers.
    addOverpass(group, world, RAPIER, mats, -42, 23, -250, 360, Math.PI / 2);
    addOverpass(group, world, RAPIER, mats, 208, 31, -35, 300, 0);

    addIndustrialField(group, world, RAPIER, mats, rng);
    addOpenBasin(group, mats);
    addContainmentSpine(group, mats);

    // Distant transport infrastructure / skyline bridges.
    for (let i = 0; i < 9; i++) {
      const x = -420 + i * 105;
      const bridge = rounded(group, [82, 2.4, 5], [x, 78 + (i % 3) * 19, -460 + (i % 2) * 30], mats.blackMetal, { radius: .25, cast: false, receive: false, worldSurface: false });
      bridge.rotation.y = (i % 2 ? .08 : -.08);
    }

    // Arrival points sit on visible roads/approaches. Full actors enter from these.
    const arrivalPoints = [
      new THREE.Vector3(0, 1, 140), new THREE.Vector3(-42, 1, 90), new THREE.Vector3(42, 1, 70),
      new THREE.Vector3(-35, 1, -60), new THREE.Vector3(35, 1, -130), new THREE.Vector3(-28, 1, -245),
      new THREE.Vector3(28, 1, -360), new THREE.Vector3(-205, 1, 95), new THREE.Vector3(220, 1, -20),
      new THREE.Vector3(-310, 1, -90), new THREE.Vector3(310, 1, 150)
    ];

    // Distant formations use these highways/valleys. start -> end moves toward the war zone.
    const swarmCorridors = [
      { start: new THREE.Vector3(0, 0, -660), end: new THREE.Vector3(0, 0, -80), width: 72 },
      { start: new THREE.Vector3(-650, 0, -80), end: new THREE.Vector3(-70, 0, -80), width: 62 },
      { start: new THREE.Vector3(650, 0, 55), end: new THREE.Vector3(80, 0, 25), width: 62 },
      { start: new THREE.Vector3(-480, 0, 500), end: new THREE.Vector3(-35, 0, 145), width: 82 },
      { start: new THREE.Vector3(500, 0, 520), end: new THREE.Vector3(40, 0, 160), width: 84 }
    ];

    const pickupSpots = [
      { type: 'health', pos: new THREE.Vector3(-42, 0, 120) },
      { type: 'health', pos: new THREE.Vector3(58, 0, -100) },
      { type: 'ammo', pos: new THREE.Vector3(0, 0, 20) },
      { type: 'ammo', pos: new THREE.Vector3(-110, 0, -185) }
    ];

    const worldHitObjects = [];
    group.traverse((o) => { if (o.isMesh && o.userData.worldSurface) worldHitObjects.push(o); });

    return { group, materials: mats, arrivalPoints, swarmCorridors, pickupSpots, worldHitObjects };
  }
};
