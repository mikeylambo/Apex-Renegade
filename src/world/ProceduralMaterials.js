import * as THREE from 'three/webgpu';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  color, float, sin, cos, abs, mix, smoothstep,
  positionWorld, normalWorld, time
} from 'three/tsl';

// Pass V: image-free, world-space procedural PBR with "surface history".
// The rule is simple: every opaque surface must still read under neutral light.

function fbmLike(scale = 1, speed = 0) {
  const p = positionWorld.mul(scale);
  const t = time.mul(speed);
  const a = sin(p.x.mul(1.31).add(p.z.mul(1.77)).add(t));
  const b = sin(p.y.mul(2.17).sub(p.x.mul(.83)).add(t.mul(.61)));
  const c = cos(p.z.mul(3.11).add(p.y.mul(1.47)).sub(t.mul(.37)));
  const d = sin(p.x.mul(6.23).add(p.y.mul(5.19)).add(p.z.mul(4.71)));
  const e = cos(p.x.mul(12.7).sub(p.z.mul(9.1)).add(p.y.mul(7.3)));
  return a.mul(.32).add(b.mul(.24)).add(c.mul(.19)).add(d.mul(.16)).add(e.mul(.09)).mul(.5).add(.5);
}

function scratches(scale = 1) {
  const p = positionWorld.mul(scale);
  const warped = p.y.mul(18).add(sin(p.x.mul(2.6)).mul(2.1)).add(sin(p.z.mul(3.2)).mul(1.4));
  return smoothstep(float(.955), float(.998), abs(sin(warped)));
}

function streaks(scale = 1) {
  const p = positionWorld.mul(scale);
  const vertical = abs(sin(p.x.mul(7.7).add(p.z.mul(4.1))));
  const broken = fbmLike(scale * .38);
  return smoothstep(float(.73), float(.97), vertical.mul(.72).add(broken.mul(.28)));
}

function edgeFacing() {
  return abs(normalWorld.y).mul(.54).add(abs(normalWorld.x).mul(.24)).add(abs(normalWorld.z).mul(.22));
}

function standardSurface({
  baseA, baseB, scale = .5, roughA = .65, roughB = .9,
  metalness = .05, scratch = .0, oxidation = null, grime = .0,
  stain = 0x07090d
}) {
  const m = new MeshStandardNodeMaterial();
  const macro = fbmLike(scale);
  const micro = fbmLike(scale * 7.0);
  const fine = fbmLike(scale * 19.0);
  let base = mix(color(baseA), color(baseB), macro.mul(.64).add(micro.mul(.25)).add(fine.mul(.11)));
  if (scratch > 0) {
    const s = scratches(scale * .33).mul(scratch);
    base = mix(base, color(0xb5bfca), s);
  }
  if (oxidation) {
    const o = smoothstep(float(.66), float(.92), fbmLike(scale * .21));
    base = mix(base, color(oxidation), o.mul(.17));
  }
  if (grime > 0) {
    const g = streaks(scale * .62).mul(grime).mul(fbmLike(scale * .18).mul(.55).add(.45));
    base = mix(base, color(stain), g);
  }
  const face = edgeFacing();
  m.colorNode = base.mul(face.mul(.085).add(.925));
  m.roughnessNode = mix(float(roughA), float(roughB), micro.mul(.68).add(fine.mul(.32)));
  m.metalnessNode = float(metalness);
  return m;
}

function spectralMaterial(hex = 0x6657ff, intensity = 1.2, speed = .45) {
  const m = new MeshStandardNodeMaterial();
  const macro = fbmLike(.48, speed);
  const veins = smoothstep(float(.76), float(.965), fbmLike(2.7, speed * 1.5));
  const cross = smoothstep(float(.84), float(.982), streaks(1.15));
  const pulse = sin(time.mul(speed * 2.2)).mul(.07).add(.93);
  m.colorNode = mix(color(0x070b14), color(0x18213c), macro.mul(.30));
  m.roughnessNode = mix(float(.16), float(.38), macro);
  m.metalnessNode = float(.52);
  m.emissiveNode = color(hex).mul(float(intensity)).mul(veins.mul(.52).add(cross.mul(.24)).add(.08)).mul(pulse);
  return m;
}

function glassLikeSpectral() {
  const m = new MeshStandardNodeMaterial();
  const n = fbmLike(1.4, .08);
  m.colorNode = mix(color(0x070c14), color(0x202c40), n.mul(.50));
  m.roughnessNode = mix(float(.06), float(.20), n);
  m.metalnessNode = float(.28);
  m.emissiveNode = color(0x7164dd).mul(smoothstep(float(.82), float(.975), fbmLike(4.1, .14))).mul(.58);
  return m;
}

function simpleNodeSurface(hex, roughness, metalness, emissive = null, emissiveIntensity = 0) {
  const m = new MeshStandardNodeMaterial();
  m.colorNode = color(hex);
  m.roughnessNode = float(roughness);
  m.metalnessNode = float(metalness);
  if (emissive) m.emissiveNode = color(emissive).mul(emissiveIntensity);
  return m;
}

export function createProceduralMaterials() {
  return {
    floor: standardSurface({ baseA: 0x151a22, baseB: 0x333b46, scale: .22, roughA: .57, roughB: .92, metalness: .07, scratch: .11, grime: .18 }),
    floorWorn: standardSurface({ baseA: 0x10151c, baseB: 0x252d37, scale: .18, roughA: .66, roughB: .96, metalness: .04, scratch: .22, grime: .34 }),
    stone: standardSurface({ baseA: 0x222933, baseB: 0x4d5864, scale: .34, roughA: .70, roughB: .97, metalness: .02, scratch: .05, grime: .22 }),
    blackStone: standardSurface({ baseA: 0x090d13, baseB: 0x242c36, scale: .29, roughA: .58, roughB: .92, metalness: .08, scratch: .08, grime: .25 }),
    metal: standardSurface({ baseA: 0x242b33, baseB: 0x7a8591, scale: .45, roughA: .20, roughB: .50, metalness: .94, scratch: .22, oxidation: 0x394149, grime: .12 }),
    blackMetal: standardSurface({ baseA: 0x06090e, baseB: 0x252c35, scale: .55, roughA: .16, roughB: .44, metalness: .97, scratch: .18, grime: .12 }),
    scarredMetal: standardSurface({ baseA: 0x11161d, baseB: 0x59636f, scale: .39, roughA: .28, roughB: .62, metalness: .89, scratch: .42, oxidation: 0x303941, grime: .24 }),
    repairMetal: standardSurface({ baseA: 0x424b55, baseB: 0x8e9aa7, scale: .72, roughA: .24, roughB: .46, metalness: .94, scratch: .10 }),
    paleMetal: standardSurface({ baseA: 0x68727e, baseB: 0xb7c1cb, scale: .62, roughA: .19, roughB: .40, metalness: .91, scratch: .18, grime: .06 }),
    composite: standardSurface({ baseA: 0x0f151d, baseB: 0x333c47, scale: .73, roughA: .44, roughB: .75, metalness: .28, scratch: .10, grime: .18 }),
    rubber: standardSurface({ baseA: 0x05070a, baseB: 0x161b21, scale: .95, roughA: .76, roughB: .96, metalness: .0, grime: .12 }),
    spectral: spectralMaterial(0x6657ff, 1.0, .38),
    spectralHot: spectralMaterial(0x8c82ff, 2.15, .9),
    spectralGlass: glassLikeSpectral(),
    amber: simpleNodeSurface(0x17130d, .34, .48, 0xd99446, .52),
    neutralLight: simpleNodeSurface(0x5b6571, .27, .46, 0xaec9df, .46),
    darkGlass: simpleNodeSurface(0x0a1119, .07, .52),
    soot: simpleNodeSurface(0x030406, .98, .0)
  };
}

export function disposeMaterials(materials) {
  for (const m of Object.values(materials)) m?.dispose?.();
}
