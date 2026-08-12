import * as THREE from 'three/webgpu';
import { sample, pass, mrt, screenUV, normalView, velocity, packNormalToRGB, unpackRGBToNormal, builtinAOContext } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';

/**
 * Apex deliberately keeps two render paths alive:
 * - quality: GTAO + TRAA + bloom for on-foot / slower composition
 * - motion: single scene pass + restrained bloom for high-speed bike traversal
 *
 * Both are created up front so changing mode does not rebuild the graph mid-play.
 */
export class PostFX {
  constructor(engine) {
    this.engine = engine;
    this.qualityPipeline = null;
    this.motionPipeline = null;
    this.pipeline = null;
    this.mode = 'direct';
    this.failed = false;
    this.motionMode = false;
    this.ao = null;
    this.bloom = null;
    this.traa = null;
    this._buildPipelines();
  }

  _buildPipelines() {
    if (this.engine.isWebGPU) {
      try {
        const quality = this._createAdvancedPipeline();
        this.qualityPipeline = quality.pipeline;
        this.ao = quality.ao;
        this.bloom = quality.bloom;
        this.traa = quality.traa;
      } catch (err) {
        console.warn('[Apex] Advanced WebGPU post pipeline unavailable; quality falls back to lightweight pipeline.', err);
      }
    }

    try {
      const motion = this._createSimplePipeline();
      this.motionPipeline = motion.pipeline;
      if (!this.bloom) this.bloom = motion.bloom;
    } catch (err) {
      console.warn('[Apex] Lightweight post pipeline unavailable; direct rendering remains available.', err);
    }

    this.qualityPipeline ||= this.motionPipeline;
    this.pipeline = this.qualityPipeline || this.motionPipeline;
    this.mode = this.qualityPipeline ? (this.ao ? 'gtao-traa-bloom' : 'bloom-only') : 'direct';
    this.failed = false;
  }

  _createAdvancedPipeline() {
    const prePass = pass(this.engine.scene, this.engine.camera);
    prePass.name = 'Apex Pre-Pass';
    prePass.transparent = false;
    prePass.setMRT(mrt({ output: packNormalToRGB(normalView), velocity }));

    const prePassNormal = sample((uv) => unpackRGBToNormal(prePass.getTextureNode().sample(uv)));
    const prePassDepth = prePass.getTextureNode('depth');
    const prePassVelocity = prePass.getTextureNode('velocity');
    const normalTexture = prePass.getTexture('output');
    normalTexture.type = THREE.UnsignedByteType;

    const scenePass = pass(this.engine.scene, this.engine.camera);
    const aoPass = ao(prePassDepth, prePassNormal, this.engine.camera);
    aoPass.resolutionScale = .5;
    aoPass.useTemporalFiltering = true;
    aoPass.samples.value = 12;
    aoPass.radius.value = .34;
    aoPass.scale.value = .48;
    aoPass.thickness.value = .90;
    scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);

    const resolved = traa(scenePass, prePassDepth, prePassVelocity, this.engine.camera);
    resolved.useSubpixelCorrection = false;
    const bloomPass = bloom(resolved, .20, .17, .95);

    const pipeline = new THREE.RenderPipeline(this.engine.renderer);
    pipeline.outputNode = resolved.add(bloomPass);
    return { pipeline, ao: aoPass, bloom: bloomPass, traa: resolved };
  }

  _createSimplePipeline() {
    const scenePass = pass(this.engine.scene, this.engine.camera);
    const sceneColor = scenePass.getTextureNode('output');
    const bloomPass = bloom(sceneColor, .16, .15, .96);
    const pipeline = new THREE.RenderPipeline(this.engine.renderer);
    pipeline.outputNode = sceneColor.add(bloomPass);
    return { pipeline, bloom: bloomPass };
  }

  setMotionMode(active) {
    const next = !!active;
    if (next === this.motionMode) return;
    this.motionMode = next;
    this.pipeline = next
      ? (this.motionPipeline || this.qualityPipeline)
      : (this.qualityPipeline || this.motionPipeline);
    this.mode = next ? 'motion-bloom' : (this.ao ? 'gtao-traa-bloom' : 'bloom-only');
  }

  update() {}

  render() {
    const active = this.pipeline;
    if (active && !this.failed) {
      try {
        active.render();
        return;
      } catch (err) {
        console.warn(`[Apex] ${this.mode} pipeline failed at runtime; degrading gracefully.`, err);
        // If quality failed, attempt the already-created lightweight path before
        // abandoning post processing entirely.
        if (active !== this.motionPipeline && this.motionPipeline) {
          try {
            this.pipeline = this.motionPipeline;
            this.motionMode = true;
            this.mode = 'motion-bloom';
            this.motionPipeline.render();
            return;
          } catch (motionErr) {
            console.warn('[Apex] Lightweight post pipeline also failed.', motionErr);
          }
        }
        this.pipeline = null;
        this.failed = true;
      }
    }
    this.engine.renderer.render(this.engine.scene, this.engine.camera);
  }
}
