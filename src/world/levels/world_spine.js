import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createProceduralMaterials } from '../ProceduralMaterials.js';
import { bus, GameState } from '../../core/GameState.js';

const WORLD_WIDTH = 2600;
const WORLD_LENGTH = 7800;

function rounded(group, size, pos, mat, opts = {}) {
  const radius = Math.min(opts.radius ?? .18, ...size.map((v) => Math.max(.01, v * .18)));
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

function addRoad(group, mats, x, z, width, length, rot = 0, pale = false) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rot;
  group.add(root);
  rounded(root, [width, .12, length], [0, .025, 0], mats.floorWorn, { radius: .08, cast: false });
  rounded(root, [width * .86, .018, length * .97], [0, .092, 0], mats.floor, { radius: .01, cast: false });
  for (let lane = -2; lane <= 2; lane++) {
    rounded(root, [.09, .015, length * .94], [lane * width / 6, .108, 0], lane === 0 && pale ? mats.neutralLight : mats.scarredMetal, { radius: .005, cast: false, worldSurface: false });
  }
  for (let zz = -length * .44; zz < length * .44; zz += 54) {
    rounded(root, [width * .72, .018, .14], [0, .112, zz], mats.paleMetal, { radius: .005, cast: false, worldSurface: false });
  }
  return root;
}

function addMegablock(group, world, RAPIER, mats, x, z, w, d, h, variant = 0, collision = true) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  group.add(root);

  rounded(root, [w, h, d], [0, h / 2, 0], variant % 3 === 0 ? mats.blackStone : mats.composite, { radius: Math.min(1.3, w * .035), segments: 3 });
  rounded(root, [w * .90, h * .94, d + .55], [0, h * .49, -.10], mats.blackMetal, { radius: .55, cast: false });

  const decks = Math.max(4, Math.floor(h / 24));
  for (let j = 1; j < decks; j++) {
    rounded(root, [w * .95, .38, d + .72], [0, (j / decks) * h, -.18], j % 3 === 0 ? mats.paleMetal : mats.scarredMetal, { radius: .07, cast: false });
  }
  const ribs = Math.max(4, Math.floor(w / 14));
  for (let i = 0; i <= ribs; i++) {
    const px = -w * .43 + (i / ribs) * w * .86;
    rounded(root, [.28, h * .82, d + .68], [px, h * .49, -.16], i % 5 === 0 ? mats.paleMetal : mats.metal, { radius: .045, cast: false });
  }

  if (variant % 2 === 0) rounded(root, [.18, h * .28, d + .78], [w * .35, h * .66, -.2], mats.spectral, { radius: .025, cast: false });

  const crown = variant % 3 === 1
    ? new THREE.Mesh(new THREE.ConeGeometry(w * .24, h * .15, 4), mats.blackStone)
    : rounded(root, [w * .46, h * .07, d * .58], [0, h + h * .035, 0], mats.scarredMetal, { radius: .24 });
  if (variant % 3 === 1) {
    crown.position.y = h + h * .065;
    crown.rotation.y = Math.PI / 4;
    crown.userData.worldSurface = false;
    root.add(crown);
  }

  if (collision) addCollider(world, RAPIER, [w, h, d], [x, h / 2, z]);
  return root;
}

function addBridge(group, world, RAPIER, mats, x, y, z, width, length, rot = 0) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rot;
  group.add(root);
  rounded(root, [width, 1.4, length], [0, 0, 0], mats.scarredMetal, { radius: .22 });
  rounded(root, [width * .92, .28, length * .98], [0, .82, 0], mats.floorWorn, { radius: .08 });
  for (const s of [-1, 1]) rounded(root, [.26, 1.05, length], [s * width * .46, 1.25, 0], mats.paleMetal, { radius: .05 });
  for (let p = -length * .38; p <= length * .38; p += 80) {
    rounded(root, [3.8, y, 3.8], [0, -y / 2, p], mats.blackStone, { radius: .25 });
  }
  addCollider(world, RAPIER, [width, 1.7, length], [x, y, z], rot);
}

function addScar(group, world, RAPIER, mats, rng) {
  // The existing city grammar, now turned into the southern anchor of a much
  // larger journey. Every accessible major block receives a simple collider.
  addRoad(group, mats, 0, 90, 104, 1250, 0, true);
  addRoad(group, mats, -245, 110, 60, 620, Math.PI / 2);
  addRoad(group, mats, 250, -50, 58, 620, Math.PI / 2);

  const blocks = [
    [-115, 390, 64, 76, 102, 0], [118, 370, 70, 82, 126, 1],
    [-154, 230, 92, 88, 158, 2], [154, 205, 84, 96, 146, 3],
    [-126, 50, 92, 90, 194, 4], [132, 20, 88, 96, 178, 5],
    [-176, -150, 122, 106, 226, 6], [176, -170, 112, 104, 214, 7],
    [-158, -390, 118, 118, 252, 8], [166, -410, 126, 112, 236, 9]
  ];
  for (const b of blocks) addMegablock(group, world, RAPIER, mats, ...b, true);

  // Upper-city roads make the city visibly three-dimensional even before the
  // player unlocks flight.
  addBridge(group, world, RAPIER, mats, -260, 26, -140, 20, 540, Math.PI / 2);
  addBridge(group, world, RAPIER, mats, 270, 38, -320, 22, 560, Math.PI / 2);

  // The underside discovery becomes intentional architecture: giant support
  // frames and suspended service spans below the elevated approaches.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = side * (315 + i * 34);
      const z = -150 - i * 95;
      rounded(group, [18, 62 + i * 8, 18], [x, 31 + i * 4, z], mats.blackStone, { radius: .7 });
      addCollider(world, RAPIER, [18, 62 + i * 8, 18], [x, 31 + i * 4, z]);
      rounded(group, [side * 0 + 52, 3.2, 10], [x - side * 23, 56 + i * 4, z], mats.scarredMetal, { radius: .3 });
    }
  }

  // Distant skyline density without physics cost; kept well outside primary
  // travel lanes so it reads as city rather than collision noise.
  for (let i = 0; i < 34; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (330 + rng() * 420);
    const z = 420 - Math.floor(i / 2) * 65 + (rng() - .5) * 45;
    addMegablock(group, world, RAPIER, mats, x, z, 42 + rng() * 58, 48 + rng() * 70, 110 + rng() * 230, i + 20, false);
  }

  // Scar gate / transition marker.
  for (const side of [-1, 1]) {
    rounded(group, [14, 98, 20], [side * 72, 49, -620], mats.blackStone, { radius: .85 });
    addCollider(world, RAPIER, [14, 98, 20], [side * 72, 49, -620]);
  }
  rounded(group, [158, 6, 22], [0, 86, -620], mats.scarredMetal, { radius: .48 });
  rounded(group, [116, .35, 7], [0, 89.4, -620], mats.spectral, { radius: .08, cast: false });
}

function addExpanse(group, world, RAPIER, mats, rng) {
  // The highway is the connective tissue. It should feel almost empty after the
  // Scar, so the player experiences distance instead of continuous content.
  addRoad(group, mats, 0, -1730, 58, 2180, 0, false);

  // Broken parallel lanes / abandoned transit remnants.
  addRoad(group, mats, -210, -1510, 22, 640, .04);
  addRoad(group, mats, 235, -2100, 24, 720, -.06);

  // Monoliths and mesa-like anchors establish SotC negative space.
  const anchors = [
    [-390, -1050, 72, 180, 38], [440, -1240, 86, 220, 52],
    [-520, -1740, 118, 290, 64], [510, -1980, 96, 260, 58],
    [-360, -2410, 82, 200, 44], [430, -2530, 104, 250, 62]
  ];
  for (let i = 0; i < anchors.length; i++) {
    const [x, z, w, h, d] = anchors[i];
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), i % 2 ? mats.blackStone : mats.stone);
    rock.scale.set(w * .52, h * .52, d * .52);
    rock.position.set(x, h * .38, z);
    rock.rotation.set(.06 * i, .31 * i, .03 * i);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.userData.worldSurface = true;
    group.add(rock);
    addCollider(world, RAPIER, [w * .78, h * .76, d * .78], [x, h * .38, z]);
  }

  // Utility towers imply civilization connecting the cities over kilometers.
  for (let i = 0; i < 22; i++) {
    const z = -780 - i * 104;
    const side = i % 2 ? -1 : 1;
    const x = side * (160 + (i % 4) * 24);
    const h = 30 + (i % 3) * 8;
    rounded(group, [3.2, h, 3.2], [x, h / 2, z], mats.scarredMetal, { radius: .15 });
    rounded(group, [42, 1.1, 2.5], [x - side * 18, h * .82, z], mats.metal, { radius: .10 });
    if (i % 4 === 0) rounded(group, [.18, h * .52, 3.5], [x + side * 1.9, h * .56, z], mats.spectral, { radius: .03, cast: false });
    addCollider(world, RAPIER, [3.4, h, 3.4], [x, h / 2, z]);
  }

  // A collapsed old causeway creates a mid-journey landmark without forcing a
  // scripted encounter.
  for (let i = 0; i < 8; i++) {
    const x = -320 + i * 86;
    const y = 16 + Math.sin(i * .8) * 6;
    const z = -1930 + Math.sin(i * .6) * 60;
    rounded(group, [78, 5, 18], [x, y, z], i % 2 ? mats.scarredMetal : mats.blackStone, { radius: .38, rotation: [0, .08 * Math.sin(i), .04 * Math.cos(i)] });
  }

  // Sparse abandoned structures give the bike something to pass rather than
  // filling every square meter with points of interest.
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (110 + rng() * 480);
    const z = -920 - rng() * 1700;
    const h = 18 + rng() * 46;
    addMegablock(group, world, RAPIER, mats, x, z, 30 + rng() * 42, 32 + rng() * 50, h, i + 70, Math.abs(x) < 250);
  }
}

function addVerticalMegacity(group, world, RAPIER, mats, rng) {
  // The first reachable apron. The full city remains mostly a silhouette in v0.1,
  // but the player can physically arrive at its lower causeway.
  addRoad(group, mats, 0, -2920, 92, 620, 0, true);

  const gateZ = -3110;
  for (const side of [-1, 1]) {
    const x = side * 105;
    rounded(group, [24, 190, 38], [x, 95, gateZ], mats.blackStone, { radius: 1.2, segments: 3 });
    rounded(group, [8, 156, 40], [x - side * 15, 96, gateZ], mats.paleMetal, { radius: .45 });
    addCollider(world, RAPIER, [24, 190, 38], [x, 95, gateZ]);
  }
  rounded(group, [242, 8, 42], [0, 166, gateZ], mats.scarredMetal, { radius: .7 });
  rounded(group, [172, .5, 8], [0, 171, gateZ - 2], mats.spectral, { radius: .10, cast: false });

  // Lower city blocks: physically real, spaced for army-scale fighting.
  const lower = [
    [-210, -3290, 116, 124, 330, 100], [220, -3310, 132, 116, 390, 101],
    [-340, -3520, 150, 140, 470, 102], [350, -3550, 142, 152, 520, 103],
    [-170, -3740, 124, 136, 590, 104], [190, -3780, 138, 130, 640, 105]
  ];
  for (const b of lower) addMegablock(group, world, RAPIER, mats, ...b, true);

  // Suspended districts and aerial roads establish the vertical promise.
  for (let layer = 0; layer < 4; layer++) {
    const y = 150 + layer * 130;
    const z = -3380 - layer * 170;
    const span = 380 + layer * 90;
    rounded(group, [span, 12, 96], [0, y, z], layer % 2 ? mats.blackStone : mats.scarredMetal, { radius: 1.2 });
    rounded(group, [span * .82, .5, 72], [0, y + 7, z], mats.floorWorn, { radius: .18 });
    if (layer < 2) addCollider(world, RAPIER, [span, 12, 96], [0, y, z]);
    for (const side of [-1, 1]) {
      rounded(group, [10, y, 10], [side * span * .37, y / 2, z], mats.blackStone, { radius: .5 });
    }
  }

  // Kilometer-class background towers. These are visual until we expand the city
  // in the next world-content pass.
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (210 + rng() * 720);
    const z = -3240 - rng() * 1500;
    const w = 80 + rng() * 120;
    const d = 80 + rng() * 120;
    const h = 420 + rng() * 760;
    addMegablock(group, world, RAPIER, mats, x, z, w, d, h, i + 140, false);
  }

  // A central needle lets the player orient from the Expanse several kilometers out.
  const needle = new THREE.Group();
  needle.position.set(0, 0, -4150);
  group.add(needle);
  rounded(needle, [110, 1180, 110], [0, 590, 0], mats.blackMetal, { radius: 2.4, segments: 3, worldSurface: false });
  rounded(needle, [18, 930, 118], [0, 650, -4], mats.paleMetal, { radius: .7, cast: false, worldSurface: false });
  rounded(needle, [2.5, 720, 124], [0, 720, -8], mats.spectral, { radius: .2, cast: false, worldSurface: false });
  const crown = new THREE.Mesh(new THREE.ConeGeometry(86, 310, 4), mats.blackStone);
  crown.position.y = 1335;
  crown.rotation.y = Math.PI / 4;
  crown.userData.worldSurface = false;
  needle.add(crown);
}

function buildWorldStateController(scene, lights) {
  let region = null;
  const regionFor = (z) => z > -690 ? 'THE SCAR' : z > -2700 ? 'THE EXPANSE' : 'VERTICAL MEGACITY // LOWER APPROACH';

  return (dt, playerPos) => {
    const next = regionFor(playerPos.z);
    if (next !== region) {
      region = next;
      bus.emit('regionChanged', { name: region });
    }

    const tier = GameState.refusalTier;
    const pressure = GameState.pressureStage;
    const expanse = region === 'THE EXPANSE';
    const vertical = region.startsWith('VERTICAL');

    const fogBase = expanse ? .00031 : vertical ? .00043 : .00052;
    const targetFog = Math.max(.00019, fogBase - tier * .000035 + pressure * .000012);
    scene.fog.density = THREE.MathUtils.damp(scene.fog.density, targetFog, 1.6, dt);

    const fogColor = new THREE.Color().setRGB(
      .028 + tier * .004,
      .055 + tier * .006,
      .082 + tier * .015
    );
    scene.fog.color.lerp(fogColor, 1 - Math.pow(.04, dt));

    // Pressure is civilization responding: warmer/harder artificial light.
    // Refusal is reality responding: conventional fill recedes while spectral rim grows.
    const hemiTarget = (expanse ? .78 : .60) - tier * .075;
    lights.hemi.intensity = THREE.MathUtils.damp(lights.hemi.intensity, Math.max(.30, hemiTarget), 1.8, dt);
    lights.sun.intensity = THREE.MathUtils.damp(lights.sun.intensity, 2.05 - tier * .16 + pressure * .08, 1.8, dt);
    lights.rim.intensity = THREE.MathUtils.damp(lights.rim.intensity, .46 + tier * .30, 2.2, dt);
    lights.spectral.intensity = THREE.MathUtils.damp(lights.spectral.intensity, .08 + tier * .42, 2.2, dt);
    lights.alert.intensity = THREE.MathUtils.damp(lights.alert.intensity, pressure * .32, 2.4, dt);

    const spectralTarget = new THREE.Color(tier >= 3 ? 0x8f86ff : 0x657b99);
    lights.rim.color.lerp(spectralTarget, 1 - Math.pow(.08, dt));
  };
}

export const WorldSpineLevel = {
  id: 'world_spine_v01',
  name: 'WORLD SPINE // THE SCAR → THE EXPANSE → VERTICAL MEGACITY',
  playerStart: new THREE.Vector3(0, 2.5, 525),

  build(engine) {
    const { scene, world, RAPIER } = engine;
    const group = new THREE.Group();
    scene.add(group);
    const mats = createProceduralMaterials();
    const rng = seeded(0x51A6C0DE);

    scene.fog = new THREE.FogExp2(0x09121b, .00052);
    engine.camera.far = 7200;
    engine.camera.updateProjectionMatrix();

    const hemi = new THREE.HemisphereLight(0xc1d4e6, 0x12161c, .60);
    group.add(hemi);
    const sun = new THREE.DirectionalLight(0xe1edf6, 2.05);
    sun.position.set(-420, 700, 580);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -420;
    sun.shadow.camera.right = 420;
    sun.shadow.camera.top = 420;
    sun.shadow.camera.bottom = -420;
    sun.shadow.camera.far = 1600;
    group.add(sun);
    const rim = new THREE.DirectionalLight(0x657b99, .46);
    rim.position.set(520, 260, -780);
    group.add(rim);
    const spectral = new THREE.PointLight(0x8075f5, .08, 1900, 1.1);
    spectral.position.set(0, 470, -3370);
    group.add(spectral);
    const alert = new THREE.DirectionalLight(0xd38b52, 0);
    alert.position.set(-280, 180, 420);
    group.add(alert);

    // One continuous physical floor. Terrain sculpting comes after the first
    // traversal/streaming certification; world scale is the priority here.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_LENGTH), mats.floorWorn);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -1500;
    ground.receiveShadow = true;
    ground.userData.worldSurface = true;
    group.add(ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(WORLD_WIDTH / 2, .25, WORLD_LENGTH / 2).setTranslation(0, -.25, -1500));

    addScar(group, world, RAPIER, mats, rng);
    addExpanse(group, world, RAPIER, mats, rng);
    addVerticalMegacity(group, world, RAPIER, mats, rng);

    // Arrival points follow the whole travel spine so escalation can pursue the
    // player between regions rather than behaving like a city-only encounter.
    const arrivalPoints = [
      new THREE.Vector3(-70, 1, 330), new THREE.Vector3(72, 1, 210),
      new THREE.Vector3(-95, 1, -80), new THREE.Vector3(90, 1, -360),
      new THREE.Vector3(-70, 1, -760), new THREE.Vector3(75, 1, -1040),
      new THREE.Vector3(-150, 1, -1420), new THREE.Vector3(145, 1, -1770),
      new THREE.Vector3(-170, 1, -2180), new THREE.Vector3(160, 1, -2520),
      new THREE.Vector3(-90, 1, -2900), new THREE.Vector3(95, 1, -3180),
      new THREE.Vector3(-180, 1, -3440), new THREE.Vector3(180, 1, -3650)
    ];

    const swarmCorridors = [
      { start: new THREE.Vector3(-45, 1, 560), end: new THREE.Vector3(-25, 1, -520), width: 52 },
      { start: new THREE.Vector3(44, 1, -620), end: new THREE.Vector3(18, 1, -1560), width: 42 },
      { start: new THREE.Vector3(-42, 1, -1120), end: new THREE.Vector3(-18, 1, -2320), width: 50 },
      { start: new THREE.Vector3(46, 1, -2040), end: new THREE.Vector3(20, 1, -3060), width: 54 },
      { start: new THREE.Vector3(-210, 1, -3060), end: new THREE.Vector3(-120, 1, -3650), width: 68 },
      { start: new THREE.Vector3(220, 1, -3100), end: new THREE.Vector3(130, 1, -3700), width: 68 }
    ];

    const pickupSpots = [
      { type: 'health', pos: new THREE.Vector3(-55, 1, 120) },
      { type: 'ammo', pos: new THREE.Vector3(58, 1, -430) },
      { type: 'health', pos: new THREE.Vector3(-36, 1, -1540) },
      { type: 'ammo', pos: new THREE.Vector3(36, 1, -2410) },
      { type: 'health', pos: new THREE.Vector3(-72, 1, -3180) }
    ];

    const worldHitObjects = [];
    group.traverse((o) => { if (o.isMesh && o.userData.worldSurface) worldHitObjects.push(o); });

    const updateWorldState = buildWorldStateController(scene, { hemi, sun, rim, spectral, alert });

    return {
      group,
      mats,
      arrivalPoints,
      swarmCorridors,
      pickupSpots,
      worldHitObjects,
      bikeSpawn: new THREE.Vector3(9, .35, 505),
      updateWorldState
    };
  }
};
