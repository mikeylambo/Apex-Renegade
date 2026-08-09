import * as THREE from 'three/webgpu';

function radialTexture(inner,mid,outer='rgba(0,0,0,0)') {
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,0,128,128,128); g.addColorStop(0,inner); g.addColorStop(.2,mid); g.addColorStop(1,outer);
  x.fillStyle=g; x.fillRect(0,0,256,256); return new THREE.CanvasTexture(c);
}
function makeSkyTexture() {
  const c=document.createElement('canvas'); c.width=1536; c.height=768; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,768);
  g.addColorStop(0,'#010308'); g.addColorStop(.34,'#050a11'); g.addColorStop(.62,'#0c1520'); g.addColorStop(.82,'#18232d'); g.addColorStop(1,'#2a3037');
  x.fillStyle=g; x.fillRect(0,0,c.width,c.height);
  // Stars are context, not the identity. Most disappear into lower atmospheric strata.
  for(let i=0;i<430;i++) { const px=Math.random()*c.width, py=Math.random()*330, a=.09+Math.random()*.48; x.fillStyle=`rgba(205,221,239,${a})`; const s=.35+Math.random()*.95; x.fillRect(px,py,s,s); }
  // Thin vertical distortion streaks make the sky feel affected rather than merely cosmic.
  for(let i=0;i<42;i++){const px=Math.random()*c.width,w=.4+Math.random()*1.6,top=70+Math.random()*270,len=40+Math.random()*180;const q=x.createLinearGradient(0,top,0,top+len);q.addColorStop(0,'rgba(120,135,175,0)');q.addColorStop(.5,`rgba(130,145,190,${.015+Math.random()*.025})`);q.addColorStop(1,'rgba(120,135,175,0)');x.fillStyle=q;x.fillRect(px,top,w,len);}
  return new THREE.CanvasTexture(c);
}
function makeCloudTexture() {
  const c=document.createElement('canvas');c.width=1536;c.height=768;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
  for(let i=0;i<170;i++){
    const px=Math.random()*c.width,py=310+Math.random()*420,rx=90+Math.random()*320,ry=24+Math.random()*80;
    const q=x.createRadialGradient(px,py,0,px,py,rx);const a=.035+Math.random()*.075;
    q.addColorStop(0,`rgba(${55+Math.random()*20},${68+Math.random()*25},${92+Math.random()*30},${a})`);q.addColorStop(.55,`rgba(35,47,65,${a*.55})`);q.addColorStop(1,'rgba(0,0,0,0)');
    x.save();x.translate(px,py);x.scale(1,ry/rx);x.fillStyle=q;x.fillRect(-rx,-rx,rx*2,rx*2);x.restore();
  }
  return new THREE.CanvasTexture(c);
}
function makeFractureTexture() {
  const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d'); x.clearRect(0,0,512,512);
  x.strokeStyle='rgba(150,145,225,.42)'; x.lineWidth=1.25;
  for(let i=0;i<20;i++) { let px=256+(Math.random()-.5)*70,py=256+(Math.random()-.5)*70; x.beginPath(); x.moveTo(px,py); for(let j=0;j<9;j++){px+=(Math.random()-.5)*38;py+=(Math.random()-.5)*38;x.lineTo(px,py);} x.stroke(); }
  return new THREE.CanvasTexture(c);
}
export class WorldAtmosphere {
  constructor(engine) {
    this.group=new THREE.Group(); engine.scene.add(this.group);
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(2100,56,32),new THREE.MeshBasicMaterial({map:makeSkyTexture(),side:THREE.BackSide,fog:false})); this.group.add(this.sky);
    this.cloudDome=new THREE.Mesh(new THREE.SphereGeometry(2060,56,32),new THREE.MeshBasicMaterial({map:makeCloudTexture(),side:THREE.BackSide,transparent:true,opacity:.92,depthWrite:false,fog:false}));this.cloudDome.rotation.y=.5;this.group.add(this.cloudDome);

    // Distant pale anomaly. Haze and cloud cover should partially hide it from most angles.
    const body=new THREE.Mesh(new THREE.SphereGeometry(112,40,28),new THREE.MeshStandardMaterial({color:0x737d88,roughness:.96,metalness:0,emissive:0x152032,emissiveIntensity:.12}));
    body.position.set(-520,430,-1580); this.group.add(body);
    const ringMat=new THREE.MeshBasicMaterial({color:0xa2afc0,transparent:true,opacity:.065,depthWrite:false});
    for(const [r,t,rot] of [[148,1.1,[.55,.2,.2]],[178,.5,[.15,.75,.1]],[204,.28,[.8,.2,.7]]]) { const ring=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,96),ringMat.clone()); ring.position.copy(body.position); ring.rotation.set(...rot); this.group.add(ring); }
    const fracture=new THREE.Sprite(new THREE.SpriteMaterial({map:makeFractureTexture(),color:0x8278d8,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    fracture.position.set(-460,380,-1390); fracture.scale.set(260,260,1); this.group.add(fracture);

    // Broad pressure rings bend across the far sky; quiet enough to read as an anomaly, not neon signage.
    this.pressureRings=[];
    for(let i=0;i<4;i++){
      const mat=new THREE.MeshBasicMaterial({color:i===2?0x796fe0:0x91a0b5,transparent:true,opacity:i===2?.045:.025,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
      const ring=new THREE.Mesh(new THREE.TorusGeometry(340+i*44,.38+i*.08,6,160,Math.PI*1.18),mat);ring.position.set(-180,300,-1500-i*42);ring.rotation.set(.75,.32,-.35+i*.11);this.group.add(ring);this.pressureRings.push(ring);
    }

    this.horizon=new THREE.Group(); this.group.add(this.horizon);
    const silhouette=new THREE.MeshStandardMaterial({color:0x070b11,roughness:.97,metalness:.04});
    for(let i=0;i<46;i++) {
      const a=i/46*Math.PI*2, d=520+Math.random()*680, h=80+Math.random()*260, w=20+Math.random()*55;
      const root=new THREE.Group(); root.position.set(Math.cos(a)*d,0,Math.sin(a)*d); root.rotation.y=-a; this.horizon.add(root);
      const tower=new THREE.Mesh(new THREE.BoxGeometry(w,h,24+Math.random()*48),silhouette); tower.position.y=h/2-2; root.add(tower);
      if(i%3===0){const crown=new THREE.Mesh(new THREE.ConeGeometry(w*.62,45+Math.random()*65,4),silhouette);crown.position.y=h+3.5;crown.rotation.y=Math.PI/4;root.add(crown);}
      if(i%5===0){const bridge=new THREE.Mesh(new THREE.BoxGeometry(w*2.9,1.05,2.3),silhouette);bridge.position.set(w*.75,h*.58,0);bridge.rotation.z=(Math.random()-.5)*.10;root.add(bridge);}
      if(i%7===0){const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.65,1.0,55,6),silhouette);antenna.position.y=h+7;root.add(antenna);}
    }

    const tex=radialTexture('rgba(225,235,247,1)','rgba(110,127,154,.30)');
    const count=1650, geo=new THREE.BufferGeometry(), p=new Float32Array(count*3), speeds=new Float32Array(count);
    for(let i=0;i<count;i++){p[i*3]=(Math.random()-.5)*1250;p[i*3+1]=Math.random()*180;p[i*3+2]=(Math.random()-.5)*1250;speeds[i]=.035+Math.random()*.10;}
    geo.setAttribute('position',new THREE.BufferAttribute(p,3)); this.speeds=speeds;
    this.drift=new THREE.Points(geo,new THREE.PointsMaterial({map:tex,size:.065,color:0xc5d2e7,transparent:true,opacity:.20,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true})); this.group.add(this.drift);

    this.haze=[];
    const hazeTex=radialTexture('rgba(155,175,198,.26)','rgba(66,82,102,.12)');
    for(let i=0;i<28;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:hazeTex,transparent:true,opacity:.13,depthWrite:false,fog:false}));const a=i/28*Math.PI*2,d=240+Math.random()*720;s.position.set(Math.cos(a)*d,5+Math.random()*14,Math.sin(a)*d);s.scale.set(180+Math.random()*360,55+Math.random()*120,1);this.group.add(s);this.haze.push(s);}
  }
  update(dt) {
    this.group.rotation.y+=dt*.00010; this.horizon.rotation.y-=dt*.000025; this.cloudDome.rotation.y+=dt*.00115;
    for(let i=0;i<this.pressureRings.length;i++)this.pressureRings[i].rotation.z+=dt*(i%2?-.0009:.00065);
    const p=this.drift.geometry.attributes.position;
    for(let i=0;i<p.count;i++){let y=p.getY(i)+dt*this.speeds[i];let x=p.getX(i)+dt*.008*Math.sin(i);if(y>180)y-=180;if(x>625)x-=1250;p.setXYZ(i,x,y,p.getZ(i));} p.needsUpdate=true;
  }
}
