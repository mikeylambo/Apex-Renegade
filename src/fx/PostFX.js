import * as THREE from 'three/webgpu';
import { sample, pass, mrt, screenUV, normalView, velocity, packNormalToRGB, unpackRGBToNormal, builtinAOContext } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';

export class PostFX {
  constructor(engine) {
    this.engine = engine;
    this.pipeline = null;
    this.mode = 'direct';
    this.failed = false;
    this._buildBestPipeline();
  }

  _buildBestPipeline() {
    if (this.engine.isWebGPU) {
      try {
        this._buildAdvancedPipeline();
        this.mode='gtao-traa-bloom';
        return;
      } catch (err) {
        console.warn('[Apex] Advanced WebGPU post pipeline unavailable; trying bloom-only.', err);
      }
    }
    this._buildSimplePipeline();
  }

  _buildAdvancedPipeline() {
    const prePass = pass(this.engine.scene, this.engine.camera);
    prePass.name='Apex Pre-Pass';
    prePass.transparent=false;
    prePass.setMRT(mrt({ output: packNormalToRGB(normalView), velocity }));

    const prePassNormal=sample((uv)=>unpackRGBToNormal(prePass.getTextureNode().sample(uv)));
    const prePassDepth=prePass.getTextureNode('depth');
    const prePassVelocity=prePass.getTextureNode('velocity');
    const normalTexture=prePass.getTexture('output');
    normalTexture.type=THREE.UnsignedByteType;

    const scenePass=pass(this.engine.scene,this.engine.camera);
    const aoPass=ao(prePassDepth,prePassNormal,this.engine.camera);
    aoPass.resolutionScale=.5;
    aoPass.useTemporalFiltering=true;
    aoPass.samples.value=12;
    aoPass.radius.value=.34;
    aoPass.scale.value=.48;
    aoPass.thickness.value=.90;
    scenePass.contextNode=builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);

    const resolved=traa(scenePass,prePassDepth,prePassVelocity,this.engine.camera);
    resolved.useSubpixelCorrection=false;
    const bloomPass=bloom(resolved,.20,.17,.95);

    this.pipeline=new THREE.RenderPipeline(this.engine.renderer);
    this.pipeline.outputNode=resolved.add(bloomPass);
    this.ao=aoPass;this.bloom=bloomPass;this.traa=resolved;
  }

  _buildSimplePipeline() {
    try {
      const scenePass=pass(this.engine.scene,this.engine.camera);
      const sceneColor=scenePass.getTextureNode('output');
      const bloomPass=bloom(sceneColor,.20,.17,.95);
      this.pipeline=new THREE.RenderPipeline(this.engine.renderer);
      this.pipeline.outputNode=sceneColor.add(bloomPass);
      this.bloom=bloomPass;this.mode='bloom-only';this.failed=false;
    } catch(err) {
      this.pipeline=null;this.mode='direct';this.failed=true;
      console.warn('[Apex] Post processing unavailable; using direct renderer.',err);
    }
  }

  update() {}

  render() {
    if (this.pipeline && !this.failed) {
      try { this.pipeline.render(); return; }
      catch(err) {
        console.warn(`[Apex] ${this.mode} pipeline failed at runtime; degrading gracefully.`,err);
        this.pipeline=null;
        if(this.mode==='gtao-traa-bloom') { this._buildSimplePipeline(); if(this.pipeline){try{this.pipeline.render();return;}catch{this.pipeline=null;}} }
        this.failed=true;
      }
    }
    this.engine.renderer.render(this.engine.scene,this.engine.camera);
  }
}
