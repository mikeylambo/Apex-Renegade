import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function makeArchetype(opts) {
  return {
    id: opts.id, name: opts.name, health: opts.health, moveSpeed: opts.moveSpeed,
    sightRange: opts.sightRange, attackRange: opts.attackRange, attackDamage: opts.attackDamage,
    attackInterval: opts.attackInterval, scoreValue: opts.scoreValue, buildMesh: opts.buildMesh,
    setHitFlash: opts.setHitFlash,
    fleesAtHighFerocity: opts.fleesAtHighFerocity ?? false,
    callsReinforcements: opts.callsReinforcements ?? false
  };
}
function mat(color, emissive=0x000000, intensity=.15, rough=.42, metal=.55) {
  return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:rough,metalness:metal});
}
function rb(size, material, radius=.04) {
  return new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],3,Math.min(radius,...size.map(v=>v*.18))),material);
}
function finish(group) { group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); return group; }

export const HOLLOW = makeArchetype({
  id:'hollow', name:'Hollow', health:40, moveSpeed:4.2, sightRange:16,
  attackRange:1.6, attackDamage:8, attackInterval:.9, scoreValue:75,
  fleesAtHighFerocity:true,
  buildMesh:()=>{
    const g=new THREE.Group(); const shell=mat(0x151b25,0x273650,.22,.49,.68); const core=mat(0x111624,0x7062ff,.95,.25,.55); const pale=mat(0x5b6572,0x000000,0,.31,.88);
    const torso=rb([.62,.92,.42],shell,.09);torso.position.y=1.04;g.add(torso);
    const chest=rb([.38,.46,.48],core,.06);chest.position.set(0,1.12,-.02);g.add(chest);
    const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,1),shell);head.position.y=1.73;g.add(head);
    const visor=rb([.30,.08,.30],core,.02);visor.position.set(0,1.76,-.20);g.add(visor);
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.29,.035,7,18),pale);collar.position.y=1.53;collar.rotation.x=Math.PI/2;g.add(collar);
    for(let i=-1;i<=1;i++){const rib=rb([.055,.34,.48],i===0?core:pale,.012);rib.position.set(i*.12,1.12,-.055);rib.rotation.z=i*.06;g.add(rib);}
    for(const s of [-1,1]){
      const shoulder=rb([.28,.24,.34],pale,.05);shoulder.position.set(s*.43,1.37,0);shoulder.rotation.z=s*.20;g.add(shoulder);
      const arm=rb([.18,.58,.19],shell,.05);arm.position.set(s*.46,.94,.02);arm.rotation.z=s*.10;g.add(arm);
      const fore=rb([.20,.34,.24],s===1?pale:shell,.045);fore.position.set(s*.48,.61,-.03);fore.rotation.z=s*.16;g.add(fore);
      const leg=rb([.22,.65,.26],shell,.05);leg.position.set(s*.20,.37,.02);g.add(leg);
      const foot=rb([.25,.14,.42],pale,.035);foot.position.set(s*.20,.07,-.08);g.add(foot);
    }
    const spine=rb([.15,.74,.20],shell,.035);spine.position.set(0,1.17,.29);spine.rotation.x=-.10;g.add(spine);
    const vane=rb([.05,.64,.32],pale,.018);vane.position.set(.12,1.40,.32);vane.rotation.z=-.18;g.add(vane);
    g.userData.baseMat=shell; return finish(g);
  },
  setHitFlash:(mesh,active)=>mesh.traverse(c=>{if(c.material&&'emissiveIntensity'in c.material)c.material.emissiveIntensity=active?1.8:(c.material.emissive?.getHex?.()===0x7062ff?.95:.18);})
});

export const ENFORCER = makeArchetype({
  id:'enforcer', name:'Enforcer', health:65, moveSpeed:2.6, sightRange:22,
  attackRange:12, attackDamage:12, attackInterval:1.6, scoreValue:120,
  callsReinforcements:true,
  buildMesh:()=>{
    const g=new THREE.Group();const armor=mat(0x202833,0x000000,0,.28,.87);const dark=mat(0x090d13,0x1c2737,.14,.34,.73);const light=mat(0x778493,0x000000,0,.23,.92);const optic=mat(0x0b111d,0x97a8c8,.78,.18,.44);
    const torso=rb([.75,1.12,.46],armor,.08);torso.position.y=1.10;g.add(torso);
    const chest=rb([.51,.50,.51],dark,.055);chest.position.set(0,1.22,-.02);g.add(chest);
    const head=rb([.42,.38,.40],dark,.08);head.position.y=1.94;g.add(head);
    const visor=rb([.34,.095,.43],optic,.025);visor.position.set(0,1.98,-.11);g.add(visor);
    for(let i=-1;i<=1;i++){const chestBar=rb([.06,.42,.53],i===0?light:dark,.012);chestBar.position.set(i*.15,1.24,-.06);g.add(chestBar);}
    const pack=rb([.46,.74,.24],dark,.06);pack.position.set(0,1.25,.33);g.add(pack);
    const antenna=rb([.035,.52,.035],light,.009);antenna.position.set(.18,2.27,.16);antenna.rotation.z=-.10;g.add(antenna);
    for(const s of [-1,1]){
      const shoulder=rb([.36,.30,.45],light,.055);shoulder.position.set(s*.52,1.48,0);g.add(shoulder);
      const arm=rb([.22,.66,.24],armor,.05);arm.position.set(s*.52,.98,0);g.add(arm);
      const thigh=rb([.28,.68,.31],dark,.05);thigh.position.set(s*.23,.40,.03);g.add(thigh);
      const shin=rb([.31,.45,.34],light,.05);shin.position.set(s*.23,.10,-.01);g.add(shin);
    }
    const rifle=rb([.18,.18,.95],armor,.035);rifle.position.set(.37,1.12,-.46);rifle.rotation.set(.10,-.18,.08);g.add(rifle);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.58,12),light);barrel.rotation.x=Math.PI/2;barrel.position.set(.38,1.12,-1.12);g.add(barrel);
    const opticRail=rb([.10,.08,.34],optic,.018);opticRail.position.set(.37,1.27,-.62);g.add(opticRail);
    const muzzle=new THREE.Mesh(new THREE.TorusGeometry(.075,.018,7,16),light);muzzle.position.set(.38,1.12,-1.42);g.add(muzzle);
    g.userData.baseMat=armor;return finish(g);
  },
  setHitFlash:(mesh,active)=>mesh.traverse(c=>{if(c.material&&'emissiveIntensity'in c.material)c.material.emissiveIntensity=active?1.7:.16;})
});

export const ENEMY_ARCHETYPES={hollow:HOLLOW,enforcer:ENFORCER};
