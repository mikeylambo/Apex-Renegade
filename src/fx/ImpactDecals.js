import * as THREE from 'three/webgpu';
import { bus } from '../core/GameState.js';

const POOL = 72;
const FORWARD = new THREE.Vector3(0,0,1);

export class ImpactDecals {
  constructor(engine) {
    this.engine=engine;
    this.items=[];
    this.cursor=0;
    const craterMat=new THREE.MeshBasicMaterial({color:0x020305,transparent:true,opacity:.72,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,side:THREE.DoubleSide});
    const rimMat=new THREE.MeshBasicMaterial({color:0xb9c8dc,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-5,side:THREE.DoubleSide});
    for(let i=0;i<POOL;i++){
      const g=new THREE.Group();g.visible=false;
      const crater=new THREE.Mesh(new THREE.CircleGeometry(.075,14),craterMat.clone());
      const rim=new THREE.Mesh(new THREE.RingGeometry(.078,.095,14),rimMat.clone());rim.position.z=.001;
      g.add(crater,rim);engine.scene.add(g);
      this.items.push({g,crater,rim,life:0,maxLife:18});
    }
    bus.on('worldHit',(payload)=>this.spawn(payload));
  }
  spawn({point,normal}){
    if(!point||!normal)return;
    const item=this.items[this.cursor];this.cursor=(this.cursor+1)%POOL;
    item.g.visible=true;item.g.position.copy(point).addScaledVector(normal,.012);
    item.g.quaternion.setFromUnitVectors(FORWARD,normal.clone().normalize());
    const s=.72+Math.random()*.58;item.g.scale.setScalar(s);item.g.rotateZ(Math.random()*Math.PI*2);
    item.crater.material.opacity=.68+Math.random()*.14;item.rim.material.opacity=.14+Math.random()*.12;
    item.life=.001;item.maxLife=14+Math.random()*12;
  }
  update(dt){
    for(const item of this.items){
      if(!item.g.visible)continue;item.life+=dt;const t=item.life/item.maxLife;
      if(t>=1){item.g.visible=false;continue;}
      if(t>.78){const f=1-(t-.78)/.22;item.crater.material.opacity=.70*f;item.rim.material.opacity=.16*f;}
    }
  }
}
