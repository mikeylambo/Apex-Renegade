import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bus } from '../core/GameState.js';

function rounded(size, mat, radius=.025, segments=4) {
  const maxR = Math.min(...size.map(v => v * .19));
  return new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segments, Math.min(radius, maxR)), mat);
}
function cyl(r, h, mat, sides=18) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r * .96, h, sides), mat); }
function torus(r, tube, mat, arc=Math.PI*2) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24, arc), mat); }
function smooth(a,b,x){const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}

function buildPistol(mats, side=1) {
  const root = new THREE.Group();
  const dark=mats.blackMetal, steel=mats.metal, pale=mats.paleMetal, comp=mats.composite, glow=mats.spectral;
  const add=(mesh,pos,rot=[0,0,0])=>{ mesh.position.set(...pos); mesh.rotation.set(...rot); root.add(mesh); return mesh; };
  add(rounded([.34,.23,.72], dark,.045), [0,.02,-.16]);
  add(rounded([.27,.15,.62], comp,.035), [0,.155,-.24]);
  add(rounded([.22,.10,.84], steel,.025), [0,.255,-.34]);
  add(rounded([.13,.06,.76], pale,.018), [0,.318,-.34]);
  add(cyl(.078,.98,pale,20), [0,.075,-.75], [Math.PI/2,0,0]);
  add(cyl(.128,.46,dark,16), [0,.075,-.56], [Math.PI/2,0,0]);
  add(cyl(.105,.31,steel,16), [0,.075,-.86], [Math.PI/2,0,0]);
  add(torus(.118,.025,dark), [0,.075,-1.165], [0,0,0]);
  add(torus(.087,.015,pale), [0,.075,-1.173], [0,0,0]);
  add(cyl(.165,.31,dark,18), [0,.015,-.16], [0,0,Math.PI/2]);
  add(cyl(.132,.345,steel,18), [0,.015,-.16], [0,0,Math.PI/2]);
  for(let i=0;i<8;i++) {
    const a=i/8*Math.PI*2;
    const lug=rounded([.042,.19,.055], dark,.009);
    lug.position.set(Math.cos(a)*.125, Math.sin(a)*.125+.015, -.16);
    lug.rotation.z=a;
    root.add(lug);
  }
  for (const s of [-1,1]) {
    add(rounded([.045,.16,.48], dark,.014), [s*.19,.085,-.31], [0,0,s*.04]);
    for (let i=0;i<4;i++) add(rounded([.025,.095,.045], pale,.006), [s*.218,.10,-.48+i*.12]);
  }
  for(let i=0;i<5;i++) add(rounded([.31,.027,.035], pale,.006), [0,.34,-.57+i*.135]);
  const grip = new THREE.Group(); grip.position.set(0,-.18,.10); grip.rotation.x=-.20; root.add(grip);
  const gAdd=(mesh,pos)=>{mesh.position.set(...pos);grip.add(mesh);};
  gAdd(rounded([.19,.52,.23],dark,.04),[0,-.20,0]);
  for(let i=0;i<4;i++) gAdd(rounded([.205,.055,.245],comp,.012),[0,-.04-i*.115,-.01]);
  gAdd(rounded([.24,.09,.29],pale,.022),[0,-.48,.035]);
  gAdd(rounded([.09,.17,.14],steel,.018),[side*.075,-.54,.08]);
  add(torus(.125,.018,pale,Math.PI*1.55), [0,-.135,.035], [Math.PI/2,0,Math.PI*.18]);
  add(rounded([.25,.08,.30],dark,.018),[0,-.11,-.04]);
  add(rounded([.11,.05,.15],steel,.012),[0,-.17,-.03]);
  add(rounded([.036,.028,.45],glow,.008),[side*.188,.205,-.36]);
  add(rounded([.028,.036,.18],glow,.007),[side*.165,-.015,-.51],[0,0,side*.24]);
  add(rounded([.022,.018,.13],glow,.005),[side*.095,.314,-.72]);
  add(rounded([.11,.075,.09],dark,.015),[0,.385,-.07]);
  add(rounded([.025,.115,.07],pale,.008),[-.065,.425,-.07],[0,0,-.18]);
  add(rounded([.025,.115,.07],pale,.008),[.065,.425,-.07],[0,0,.18]);
  const bolt=rounded([.17,.055,.31],pale,.012);bolt.position.set(0,.345,-.16);root.add(bolt);
  const boltCore=rounded([.105,.035,.34],dark,.009);boltCore.position.set(0,.376,-.16);root.add(boltCore);

  // Visible spectral power cell gives the dual-pistol reload a readable object
  // exchange instead of just moving the hands offscreen.
  const reloadCell=rounded([.10,.24,.13],glow,.018,3);
  reloadCell.position.set(side*.055,-.52,.18);
  root.add(reloadCell);
  root.userData.bolt=bolt;
  root.userData.boltCore=boltCore;
  root.userData.reloadCell=reloadCell;
  root.userData.reloadCellBase=reloadCell.position.clone();

  root.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; o.frustumCulled=false; o.renderOrder=8; } });
  return root;
}

function buildGauntlet(mats, side=1) {
  const g=new THREE.Group();
  const dark=mats.blackMetal, pale=mats.paleMetal, comp=mats.composite;
  const palm=rounded([.25,.20,.40],comp,.05); palm.position.set(0,0,.03); g.add(palm);
  const wrist=rounded([.29,.18,.24],dark,.045); wrist.position.set(0,-.02,.28); g.add(wrist);
  for(let i=0;i<3;i++) {
    const plate=rounded([.28-i*.025,.045,.13],i===1?pale:dark,.014);
    plate.position.set(0,.11+i*.035,.03+i*.10); plate.rotation.x=-.08*i; g.add(plate);
  }
  const cuff=rounded([.34,.22,.18],dark,.04); cuff.position.set(0,-.03,.43); g.add(cuff);
  const outer=rounded([.07,.16,.32],pale,.02); outer.position.set(side*.16,.02,.18); outer.rotation.z=side*.12; g.add(outer);
  g.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.renderOrder=7;}});
  return g;
}

export class WeaponViewmodel {
  constructor(engine,camera,mats) {
    this.root=new THREE.Group(); camera.add(this.root);
    this.leftArm=new THREE.Group(); this.rightArm=new THREE.Group(); this.root.add(this.leftArm,this.rightArm);
    this.left=buildPistol(mats,-1); this.right=buildPistol(mats,1);
    this.gloveL=buildGauntlet(mats,-1); this.gloveR=buildGauntlet(mats,1);
    this.leftArm.add(this.gloveL,this.left); this.rightArm.add(this.gloveR,this.right);
    this.root.scale.setScalar(.88);
    this.leftArm.position.set(-.38,-.40,-1.00); this.rightArm.position.set(.38,-.40,-1.00);
    this.leftArm.rotation.set(-.035,.075,-.032); this.rightArm.rotation.set(-.035,-.075,.032);
    this.gloveL.position.set(0,-.10,.34); this.gloveR.position.set(0,-.10,.34);

    const flashMat=new THREE.MeshBasicMaterial({color:0xffe5b6,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    this.flashL=new THREE.Group(); this.flashR=new THREE.Group();
    for(const f of [this.flashL,this.flashR]) {
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.12,1),flashMat.clone());
      const spike=new THREE.Mesh(new THREE.ConeGeometry(.085,.55,7),flashMat.clone()); spike.rotation.x=-Math.PI/2; spike.position.z=-.25;
      f.add(core,spike); this.root.add(f);
    }
    this.flashL.position.set(-.41,-.29,-2.10); this.flashR.position.set(.41,-.29,-2.10);
    this.muzzleLight=new THREE.PointLight(0xffd9ad,0,7,2); this.muzzleLight.position.set(0,-.25,-1.85); this.root.add(this.muzzleLight);
    this.reloadLight=new THREE.PointLight(0x8878ff,0,4.5,2);this.reloadLight.position.set(0,-.62,-.72);this.root.add(this.reloadLight);
    this.kickL=0; this.kickR=0; this.t=0; this.reloadTimer=0; this.reloadDuration=1; this.reloadP=0;

    this.casings=[];this.casingCursor=0;
    const casingMat=new THREE.MeshStandardMaterial({color:0xb2a27d,roughness:.28,metalness:.86});
    for(let i=0;i<18;i++){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.075,8),casingMat);mesh.visible=false;mesh.rotation.z=Math.PI/2;mesh.renderOrder=7;camera.add(mesh);this.casings.push({mesh,vel:new THREE.Vector3(),spin:new THREE.Vector3(),life:0});}

    bus.on('weaponFired',({side})=>{
      if(side===0){this.kickL=1;this.flashL.children.forEach(c=>c.material.opacity=1);} else {this.kickR=1;this.flashR.children.forEach(c=>c.material.opacity=1);}
      this._ejectCasing(side);
      this.muzzleLight.intensity=7.5;
    });
    bus.on('reloadStart',({name,duration})=>{
      if(name==='Corona Blaster'){
        this.reloadTimer=duration;
        this.reloadDuration=Math.max(.001,duration);
        this.reloadP=0;
      }
    });
  }

  _ejectCasing(side){
    const c=this.casings[this.casingCursor];this.casingCursor=(this.casingCursor+1)%this.casings.length;
    const s=side===0?-1:1;c.mesh.visible=true;c.mesh.position.set(s*.35,-.12,-1.12);c.vel.set(s*(.52+Math.random()*.30),.72+Math.random()*.38,.35+Math.random()*.25);c.spin.set(Math.random()*10,Math.random()*14,Math.random()*12);c.life=.001;
  }

  _animateReload(gun, side, p) {
    const cell=gun.userData.reloadCell;
    const base=gun.userData.reloadCellBase;
    if(!cell||!base)return;
    let cellDrop=0;
    if(p<.46) cellDrop=smooth(.16,.46,p);
    else if(p<.58) cellDrop=1;
    else cellDrop=1-smooth(.58,.84,p);
    cell.position.set(base.x + side*.075*cellDrop, base.y-.40*cellDrop, base.z+.045*cellDrop);
    cell.rotation.z=side*.42*cellDrop;
  }

  update(dt,player) {
    this.t+=dt; const speed=Math.min(1,Math.hypot(player.velocity.x,player.velocity.z)/10);
    this.root.position.x=Math.sin(this.t*6.7)*.007*speed;
    this.root.position.y=Math.abs(Math.sin(this.t*13.4))*-.007*speed;
    this.root.rotation.z=Math.sin(this.t*3.3)*.0026*speed;
    this.kickL=THREE.MathUtils.damp(this.kickL,0,20,dt); this.kickR=THREE.MathUtils.damp(this.kickR,0,20,dt);

    let p=0, pose=0, chamber=0;
    if(this.reloadTimer>0){
      this.reloadTimer=Math.max(0,this.reloadTimer-dt);
      p=1-this.reloadTimer/this.reloadDuration;
      this.reloadP=p;
      const enter=smooth(0,.22,p);
      const exit=1-smooth(.72,1,p);
      pose=Math.min(enter,exit);
      chamber=Math.sin(THREE.MathUtils.clamp((p-.64)/.24,0,1)*Math.PI);
      this.reloadLight.intensity=THREE.MathUtils.damp(this.reloadLight.intensity,1.8+chamber*5.5,18,dt);
    } else {
      this.reloadP=0;
      this.reloadLight.intensity=THREE.MathUtils.damp(this.reloadLight.intensity,0,18,dt);
    }

    this.leftArm.position.z=-1.00+this.kickL*.13+pose*.10; this.rightArm.position.z=-1.00+this.kickR*.13+pose*.10;
    this.leftArm.position.x=-.38-pose*.19;this.rightArm.position.x=.38+pose*.19;
    this.leftArm.position.y=-.40-pose*.34;this.rightArm.position.y=-.40-pose*.34;
    this.leftArm.rotation.x=-.035-this.kickL*.13+pose*.52; this.rightArm.rotation.x=-.035-this.kickR*.13+pose*.52;
    this.leftArm.rotation.y=.075-pose*.20;this.rightArm.rotation.y=-.075+pose*.20;
    this.leftArm.rotation.z=-.032-pose*.46;this.rightArm.rotation.z=.032+pose*.46;

    this._animateReload(this.left,-1,p);
    this._animateReload(this.right,1,p);

    const mech=[[this.left,this.kickL],[this.right,this.kickR]];
    for(const [gun,k] of mech){if(gun.userData.bolt){gun.userData.bolt.position.z=-.16+k*.16+chamber*.18;gun.userData.boltCore.position.z=-.16+k*.16+chamber*.18;}}

    for(const c of this.casings){if(!c.mesh.visible)continue;c.life+=dt;if(c.life>.72){c.mesh.visible=false;continue;}c.mesh.position.addScaledVector(c.vel,dt);c.vel.y-=2.4*dt;c.mesh.rotation.x+=c.spin.x*dt;c.mesh.rotation.y+=c.spin.y*dt;c.mesh.rotation.z+=c.spin.z*dt;}
    for(const f of [this.flashL,this.flashR]) for(const c of f.children)c.material.opacity=THREE.MathUtils.damp(c.material.opacity,0,36,dt);
    this.muzzleLight.intensity=THREE.MathUtils.damp(this.muzzleLight.intensity,0,31,dt);
  }
}
