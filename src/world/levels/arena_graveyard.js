import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createProceduralMaterials } from '../ProceduralMaterials.js';

const ARENA_SIZE = 34;
const WALL_HEIGHT = 6;

function roundedBox(group,size,pos,mat,{cast=true,receive=true,rotation=null,radius=.08,segments=3,worldSurface=true}={}){
  const maxR=Math.min(...size.map(v=>v*.18));
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],segments,Math.min(radius,maxR)),mat);
  mesh.position.set(...pos); if(rotation)mesh.rotation.set(...rotation); mesh.castShadow=cast; mesh.receiveShadow=receive; mesh.userData.worldSurface=worldSurface; group.add(mesh); return mesh;
}
function box(group,size,pos,mat,opts={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat); mesh.position.set(...pos); if(opts.rotation)mesh.rotation.set(...opts.rotation); mesh.castShadow=opts.cast??true;mesh.receiveShadow=opts.receive??true;mesh.userData.worldSurface=opts.worldSurface??true;group.add(mesh);return mesh;
}
function cyl(group,r,h,pos,mat,rot=[0,0,0],sides=16,{worldSurface=true}={}){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.96,h,sides),mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;m.userData.worldSurface=worldSurface;group.add(m);return m;}
function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

function addContactShadow(group,x,z,sx,sz,opacity=.18){
  const mat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,32),mat);mesh.rotation.x=-Math.PI/2;mesh.scale.set(sx,sz,1);mesh.position.set(x,.068,z);mesh.userData.worldSurface=false;group.add(mesh);return mesh;
}

function buildVossMesh() {
  const group=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:0x131820,emissive:0x24365a,emissiveIntensity:.18,roughness:.28,metalness:.72});
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.86,1.08,2.7,12),bodyMat);torso.position.y=1.9;torso.castShadow=true;
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,2),new THREE.MeshStandardMaterial({color:0x0a0d13,emissive:0x6b5eff,emissiveIntensity:.72,roughness:.24,metalness:.62}));head.position.y=3.62;head.castShadow=true;
  group.add(torso,head);
  for(const s of [-1,1]){const fin=new THREE.Mesh(new THREE.BoxGeometry(.08,.78,.38),bodyMat);fin.position.set(s*.39,4.0,.06);fin.rotation.z=-s*.48;group.add(fin);}
  return group;
}

function addWallBay(root, x, y, width, height, depth, mats, spectral=false) {
  roundedBox(root,[width,height,depth],[x,y,0],mats.blackStone,{radius:.11});
  roundedBox(root,[width-.28,height-.32,depth+.055],[x,y+.01,-depth*.035],mats.composite,{radius:.07});
  roundedBox(root,[width-.62,height-.72,depth+.085],[x,y+.01,-depth*.055],mats.metal,{radius:.045});
  roundedBox(root,[width-.78,height-.88,depth+.115],[x,y+.01,-depth*.07],mats.blackMetal,{radius:.04});
  for(let r=-1;r<=1;r+=2) roundedBox(root,[.09,height-.52,depth+.14],[x+r*(width*.5-.22),y,-depth*.08],mats.paleMetal,{radius:.016});
  for(let j=-1;j<=1;j++) roundedBox(root,[width-.58,.055,depth+.15],[x,y+j*(height*.29),-depth*.085],mats.metal,{radius:.012});
  if(spectral) roundedBox(root,[.032,height*.54,depth+.17],[x+width*.31,y,-depth*.09],mats.spectral,{radius:.006,cast:false});
}

function addWallSegment(group, pos, rotY, length, mats) {
  const root=new THREE.Group(); root.position.set(...pos); root.rotation.y=rotY; group.add(root);
  roundedBox(root,[length,6.2,1.0],[0,3.1,0],mats.blackStone,{radius:.12});
  roundedBox(root,[length+.25,.34,1.35],[0,.17,0],mats.metal,{radius:.06});
  roundedBox(root,[length+.18,.24,1.24],[0,6.05,0],mats.paleMetal,{radius:.05});
  const bays=Math.floor(length/4.25); const bayW=(length-1.0)/bays;
  for(let i=0;i<bays;i++) addWallBay(root,-length*.5+.5+bayW*(i+.5),3.0,bayW-.22,4.75,1.02,mats,i%4===1);
  for(let i=0;i<bays;i++) roundedBox(root,[bayW-.35,.38,1.65],[-length*.5+.5+bayW*(i+.5),.72,.18],mats.composite,{radius:.04,rotation:[-.12,0,0]});
  for(let i=0;i<3;i++) roundedBox(root,[1.15+i*.18,.028,.72],[-length*.32+i*length*.28,2.15+i*.67,-.585],i===1?mats.repairMetal:mats.scarredMetal,{radius:.018,cast:false});
  return root;
}

function addPylon(group,x,z,h,mats,rotY=0,scale=1){
  const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rotY;root.scale.setScalar(scale);group.add(root);
  roundedBox(root,[2.75,h,2.75],[0,h/2,0],mats.blackStone,{radius:.13});
  roundedBox(root,[2.32,h-.48,2.86],[0,h/2-.02,0],mats.composite,{radius:.08});
  for(const s of [-1,1]){
    roundedBox(root,[.28,h*.78,.38],[s*1.24,h*.53,.02],mats.metal,{radius:.035});
    for(let y=1.0;y<h-.7;y+=1.12) roundedBox(root,[.44,.12,.48],[s*1.25,y,.02],mats.paleMetal,{radius:.018});
  }
  for(let y=.8;y<h-.55;y+=1.1) roundedBox(root,[2.50,.055,2.94],[0,y,0],mats.metal,{radius:.01,cast:false});
  roundedBox(root,[3.1,.30,3.1],[0,.17,0],mats.metal,{radius:.07});
  roundedBox(root,[3.0,.24,3.0],[0,h-.12,0],mats.paleMetal,{radius:.06});
  roundedBox(root,[.035,h*.27,2.98],[1.39,h*.61,0],mats.spectral,{radius:.006,cast:false});
  roundedBox(root,[2.95,.22,2.98],[0,h*.42,0],mats.scarredMetal,{radius:.03});
  roundedBox(root,[.66,.76,.025],[-.72,h*.64,-1.445],mats.repairMetal,{radius:.02,cast:false});
  addContactShadow(root,0,0,1.55,1.22,.14);
  return root;
}

function addArch(group,x,z,mats,rotation=0,scale=1){
  const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rotation;root.scale.setScalar(scale);group.add(root);
  for(const s of [-1,1]){
    roundedBox(root,[1.45,8.2,2.0],[s*3.45,4.1,0],mats.blackStone,{radius:.13});
    roundedBox(root,[.68,7.45,2.12],[s*3.45,4.05,-.02],mats.metal,{radius:.06});
    for(let y=.75;y<7.7;y+=1.15) roundedBox(root,[1.63,.10,2.18],[s*3.45,y,0],mats.paleMetal,{radius:.018});
  }
  for(let i=0;i<11;i++){
    const a=Math.PI*(.04+i/10*.92), px=Math.cos(a)*3.45,py=7.65+Math.sin(a)*3.25;
    const seg=roundedBox(root,[1.17,.76,2.0],[px,py,0],i===5?mats.paleMetal:mats.blackStone,{radius:.075});seg.rotation.z=a-Math.PI/2;
  }
  roundedBox(root,[.18,.62,2.14],[0,10.86,0],mats.spectral,{radius:.025,cast:false});
}

function addDistantStructure(group,angle,dist,mats,variant=0){
  const root=new THREE.Group();root.position.set(Math.cos(angle)*dist,0,Math.sin(angle)*dist);root.rotation.y=-angle+Math.PI/2;group.add(root);
  const h=38+variant*15,w=10+variant*2.5;
  roundedBox(root,[w,h,8],[0,h/2-3,0],mats.blackStone,{radius:.18,cast:false,receive:false,worldSurface:false});
  for(let i=-2;i<=2;i++)roundedBox(root,[.55,h*.76,8.15],[i*w*.17,h*.55,.05],mats.metal,{radius:.03,cast:false,receive:false,worldSurface:false});
  for(let j=0;j<5;j++)roundedBox(root,[w*.78,.16,8.22],[0,5+j*h*.15,.08],mats.paleMetal,{radius:.025,cast:false,receive:false,worldSurface:false});
  const crown=new THREE.Mesh(new THREE.ConeGeometry(w*.68,13,4),mats.blackStone);crown.position.y=h+3;crown.rotation.y=Math.PI/4;crown.userData.worldSurface=false;root.add(crown);
  if(variant===2){const ring=new THREE.Mesh(new THREE.TorusGeometry(w*.9,.16,8,48),mats.spectral);ring.position.y=h*.73;ring.rotation.y=Math.PI/2;ring.userData.worldSurface=false;root.add(ring);}
}

function addCoverModule(group,x,z,mats,rot=0){
  const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rot;group.add(root);
  roundedBox(root,[3.6,1.15,1.45],[0,.58,0],mats.blackStone,{radius:.12});
  roundedBox(root,[3.18,.72,1.54],[0,.75,-.02],mats.composite,{radius:.07});
  for(const s of [-1,1]) roundedBox(root,[.22,1.02,1.60],[s*1.55,.62,0],mats.paleMetal,{radius:.025});
  roundedBox(root,[1.28,.05,1.62],[.55,1.12,0],mats.neutralLight,{radius:.008,cast:false});
  roundedBox(root,[.70,.026,1.57],[-.62,.76,-.03],mats.scarredMetal,{radius:.012,cast:false});
  addContactShadow(root,0,0,1.9,.86,.20);
}

function addContainmentCrown(group,mats){
  const root=new THREE.Group();root.position.set(0,17,-45);root.rotation.set(-.12,.08,.02);group.add(root);
  const ringDefs=[
    {r:11.4,t:.34,arc:Math.PI*1.54,rot:.18,mat:mats.blackMetal},
    {r:9.65,t:.17,arc:Math.PI*1.36,rot:-.42,mat:mats.paleMetal},
    {r:7.92,t:.10,arc:Math.PI*1.22,rot:.72,mat:mats.spectral}
  ];
  for(const d of ringDefs){const ring=new THREE.Mesh(new THREE.TorusGeometry(d.r,d.t,10,128,d.arc),d.mat);ring.rotation.z=d.rot;ring.rotation.y=.04;ring.userData.worldSurface=false;root.add(ring);}
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2+.08,r=10.55;
    const spine=roundedBox(root,[.48,2.5,.72],[Math.cos(a)*r,Math.sin(a)*r,0],i%4===0?mats.repairMetal:mats.scarredMetal,{radius:.07,cast:false,receive:false,worldSurface:false});spine.rotation.z=a-Math.PI/2;
  }
  for(let i=0;i<5;i++){
    const x=-7+i*3.3; roundedBox(root,[1.55,5.5-i*.45,.30],[x,-10.8+i*.9,1.0+i*.20],mats.blackStone,{radius:.08,rotation:[0,0,(i-2)*.07],cast:false,receive:false,worldSurface:false});
    roundedBox(root,[.09,4.2-i*.35,.34],[x+.42,-10.6+i*.9,.82+i*.20],i===2?mats.spectral:mats.paleMetal,{radius:.016,cast:false,receive:false,worldSurface:false});
  }
  const coreMat=new THREE.MeshBasicMaterial({color:0x7b72d8,transparent:true,opacity:.09,depthWrite:false,blending:THREE.AdditiveBlending});
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.38,.85,21,20,1,true),coreMat);core.position.y=-.2;core.userData.worldSurface=false;root.add(core);
}

function addSurfaceHistory(group,mats){
  const rng=seeded(0xA93C51);
  for(let i=0;i<24;i++){
    const x=(rng()-.5)*27,z=(rng()-.5)*27;
    if(Math.hypot(x,z)<3.6) continue;
    const w=.45+rng()*1.35,d=.22+rng()*.72;
    const p=roundedBox(group,[w,.018,d],[x,.073,z],i%3===0?mats.repairMetal:mats.scarredMetal,{radius:.018,cast:false,rotation:[0,rng()*Math.PI,0]});
    p.userData.worldSurface=true;
  }
  for(let i=0;i<18;i++){
    const x=(rng()-.5)*26,z=(rng()-.5)*26,w=.55+rng()*1.7,d=.24+rng()*.8;
    const puddle=roundedBox(group,[w,.006,d],[x,.076,z],mats.darkGlass,{radius:.06,cast:false,receive:false,rotation:[0,rng()*Math.PI,0]});puddle.userData.worldSurface=false;
  }
  for(let i=0;i<44;i++){
    const a=rng()*Math.PI*2,r=7+rng()*9,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const frag=roundedBox(group,[.12+rng()*.52,.08+rng()*.20,.12+rng()*.55],[x,.10+rng()*.10,z],i%5===0?mats.paleMetal:mats.scarredMetal,{radius:.02,rotation:[rng()*.5,rng()*Math.PI,rng()*.5],cast:true});frag.userData.worldSurface=true;
  }
  const geo=new THREE.CylinderGeometry(.035,.035,.022,10);const bolts=new THREE.InstancedMesh(geo,mats.paleMetal,500);const m=new THREE.Matrix4();let n=0;
  for(let x=-15;x<=15;x+=3)for(let z=-15;z<=15;z+=3){for(const [ox,oz] of [[1.22,1.22],[-1.22,1.22],[1.22,-1.22],[-1.22,-1.22]]){m.makeTranslation(x+ox,.084,z+oz);bolts.setMatrixAt(n++,m);}}
  bolts.count=n;bolts.castShadow=false;bolts.receiveShadow=true;bolts.userData.worldSurface=true;group.add(bolts);
  for(const side of [-1,1]){
    const pts=[];for(let i=0;i<7;i++)pts.push(new THREE.Vector3(side*(10.7+Math.sin(i*.9)*.6),.11,-13+i*4.1));
    const curve=new THREE.CatmullRomCurve3(pts);const cable=new THREE.Mesh(new THREE.TubeGeometry(curve,64,.055,8,false),mats.rubber);cable.castShadow=true;cable.receiveShadow=true;cable.userData.worldSurface=true;group.add(cable);
    const tracer=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p)=>p.clone().add(new THREE.Vector3(side*.07,.035,0)))),64,.012,6,false),mats.neutralLight);tracer.userData.worldSurface=false;group.add(tracer);
  }
}

export const GraveyardLevel={
  id:'graveyard',name:'The Scar',playerStart:new THREE.Vector3(0,2,12),
  build(engine){
    const{scene,world,RAPIER,renderer}=engine;const group=new THREE.Group();scene.add(group);const mats=createProceduralMaterials(renderer);
    const hemi=new THREE.HemisphereLight(0xb4c6d8,0x11161e,.54);
    const key=new THREE.DirectionalLight(0xcfe0ee,2.55);key.position.set(-18,29,12);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00018;key.shadow.camera.left=-40;key.shadow.camera.right=40;key.shadow.camera.top=40;key.shadow.camera.bottom=-40;
    const rim=new THREE.DirectionalLight(0x667b94,.86);rim.position.set(22,10,-25);
    const neutralA=new THREE.PointLight(0xaec9dc,3.8,17,2);neutralA.position.set(-11,4,-10);
    const neutralB=new THREE.PointLight(0x859cb4,2.8,15,2);neutralB.position.set(12,3,8);
    group.add(hemi,key,rim,neutralA,neutralB);

    const ground=new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE,ARENA_SIZE,1,1),mats.floorWorn);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.worldSurface=true;group.add(ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(ARENA_SIZE/2,.1,ARENA_SIZE/2).setTranslation(0,-.1,0));

    for(let x=-15;x<=15;x+=3)for(let z=-15;z<=15;z+=3){
      const alt=(Math.abs(x/3)+Math.abs(z/3))%4;
      roundedBox(group,[2.76,.035,2.76],[x,.025,z],alt===0?mats.blackStone:alt===1?mats.composite:alt===2?mats.floor:mats.floorWorn,{radius:.055,cast:false});
      if(alt===0) roundedBox(group,[2.08,.018,.06],[x,.052,z+1.18],mats.metal,{radius:.008,cast:false});
    }
    for(let i=-14;i<=14;i+=2){
      roundedBox(group,[.045,.026,1.38],[0,.058,i],i%10===0?mats.spectral:mats.neutralLight,{radius:.008,cast:false});
      if(Math.abs(i)>5)roundedBox(group,[1.38,.026,.045],[i,.058,0],mats.neutralLight,{radius:.008,cast:false});
    }
    addSurfaceHistory(group,mats);

    const wallDefs=[
      {pos:[0,WALL_HEIGHT/2,ARENA_SIZE/2],size:[ARENA_SIZE,WALL_HEIGHT,1],vpos:[0,0,16.45],rot:0},
      {pos:[0,WALL_HEIGHT/2,-ARENA_SIZE/2],size:[ARENA_SIZE,WALL_HEIGHT,1],vpos:[0,0,-16.45],rot:Math.PI},
      {pos:[ARENA_SIZE/2,WALL_HEIGHT/2,0],size:[1,WALL_HEIGHT,ARENA_SIZE],vpos:[16.45,0,0],rot:-Math.PI/2},
      {pos:[-ARENA_SIZE/2,WALL_HEIGHT/2,0],size:[1,WALL_HEIGHT,ARENA_SIZE],vpos:[-16.45,0,0],rot:Math.PI/2}
    ];
    for(const w of wallDefs){world.createCollider(RAPIER.ColliderDesc.cuboid(w.size[0]/2,w.size[1]/2,w.size[2]/2).setTranslation(...w.pos));addWallSegment(group,w.vpos,w.rot,ARENA_SIZE,mats);}

    const pylons=[[-12,-12,7.5],[-6,-12,8.1],[6,-12,8.1],[12,-12,7.5],[-12,12,7.5],[-6,12,8.1],[6,12,8.1],[12,12,7.5],[-12,-6,7.8],[-12,6,7.8],[12,-6,7.8],[12,6,7.8]];
    for(const [x,z,h] of pylons)addPylon(group,x,z,h,mats,Math.atan2(x,z));

    const pillarLayout=[[8,6,4.8],[-8,6,5.4],[8,-6,5.8],[-8,-6,4.9],[0,-11,5.8],[11,1,4.5],[-11,-2,5.2]];
    for(let i=0;i<pillarLayout.length;i++){const[x,z,h]=pillarLayout[i];addPylon(group,x,z,h,mats,i*.37,.72);world.createCollider(RAPIER.ColliderDesc.cuboid(.95,h/2,.95).setTranslation(x,h/2,z));}
    addCoverModule(group,-4,2,mats,.12);addCoverModule(group,5,-1,mats,-.24);addCoverModule(group,-3,-7,mats,Math.PI/2);

    addArch(group,0,-14.55,mats,0,1.18);addArch(group,-14.6,1,mats,Math.PI/2,.82);
    addContainmentCrown(group,mats);

    addDistantStructure(group,-2.42,74,mats,0);addDistantStructure(group,-1.48,96,mats,1);addDistantStructure(group,.04,88,mats,2);addDistantStructure(group,2.18,112,mats,1);addDistantStructure(group,.72,134,mats,0);
    for(let i=0;i<9;i++){const a=-2.7+i*.55,d=52+(i%3)*9;const bridge=roundedBox(group,[17+(i%2)*8,.75,2.0],[Math.cos(a)*d,13+(i%4)*3,Math.sin(a)*d],mats.blackStone,{radius:.11,cast:false,receive:false,worldSurface:false});bridge.rotation.y=-a+(i%2)*.15;bridge.rotation.z=(i%3-1)*.035;}

    const tear=new THREE.Group();tear.position.set(0,0,-4);group.add(tear);
    roundedBox(tear,[3.6,.36,3.6],[0,.2,0],mats.blackMetal,{radius:.08});
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const arm=roundedBox(tear,[.22,1.2,.30],[Math.cos(a)*1.35,.75,Math.sin(a)*1.35],mats.paleMetal,{radius:.035});arm.rotation.y=-a;arm.rotation.z=(i%2?-.18:.18);}
    for(let i=0;i<5;i++){const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.18+i*.025,0),i===2?mats.spectralHot:mats.spectralGlass);const a=i/5*Math.PI*2;shard.scale.set(.6,4.8+i*.45,.6);shard.position.set(Math.cos(a)*.62,1.55+Math.sin(i)*.12,Math.sin(a)*.62);shard.rotation.set((i-.2)*.15,a,.2);shard.userData.worldSurface=true;tear.add(shard);}
    const tearLight=new THREE.PointLight(0x756cff,3.5,9,2);tearLight.position.y=2;tear.add(tearLight);

    const spawnPoints=[new THREE.Vector3(14,1,14),new THREE.Vector3(-14,1,14),new THREE.Vector3(14,1,-14),new THREE.Vector3(-14,1,-14),new THREE.Vector3(0,1,-15),new THREE.Vector3(15,1,0),new THREE.Vector3(-15,1,0)];
    const pickupSpots=[{type:'health',pos:new THREE.Vector3(5,0,0)},{type:'health',pos:new THREE.Vector3(-5,0,-5)},{type:'ammo',pos:new THREE.Vector3(-5,0,5)},{type:'ammo',pos:new THREE.Vector3(5,0,-8)}];
    const waveDefs=[{composition:[{type:'hollow',count:4}]},{composition:[{type:'hollow',count:5},{type:'enforcer',count:1}]},{composition:[{type:'hollow',count:3},{type:'enforcer',count:1}],ruptureCount:1},{composition:[{type:'hollow',count:4},{type:'enforcer',count:2}],ruptureCount:2}];
    const bossDef={id:'boss_voss',name:'Voss',atWave:5,health:1400,moveSpeed:3.4,attackRange:3.2,attackDamage:22,attackInterval:1.3,scoreValue:5000,buildMesh:buildVossMesh,setHitFlash:(mesh,active)=>{mesh.children.forEach(c=>{if(c.material&&'emissiveIntensity'in c.material)c.material.emissiveIntensity=active?1.8:.35;});},phases:[{belowPct:.66,speedMult:1.25,attackIntervalMult:.8},{belowPct:.33,speedMult:1.55,attackIntervalMult:.6}]};
    const worldHitObjects=[];group.traverse(o=>{if(o.isMesh&&o.userData.worldSurface)worldHitObjects.push(o);});
    return{group,spawnPoints,pickupSpots,waveDefs,bossDef,materials:mats,worldHitObjects};
  }
};
