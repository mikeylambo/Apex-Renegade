import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class Engine {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.fixedStep = 1 / 60;
    this.accumulator = 0;
    this.updateCallbacks = [];
    this.fixedUpdateCallbacks = [];
    this.renderCallbacks = [];
    this.paused = true;
    this.visualWarnings = [];
    this.perf = { frameMs: 0, fixedMs: 0, updateMs: 0, renderMs: 0, fixedSteps: 0 };
    this._initSceneShell();
  }

  async initRenderer() {
    this.renderer = new THREE.WebGPURenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.86;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    await this.renderer.init();
    this.container.appendChild(this.renderer.domElement);
    this.isWebGPU = !!navigator.gpu && this.renderer.backend?.isWebGPUBackend !== false;

    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environmentRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      this.scene.environment = this.environmentRT.texture;
      this.scene.environmentIntensity = 0.34;
      pmrem.dispose();
    } catch (err) {
      this.visualWarnings.push(`Environment PMREM disabled: ${err?.message || err}`);
      console.warn('[Apex] PMREM unavailable; using authored lights only.', err);
    }

    window.addEventListener('resize', () => this._onResize());
  }

  _initSceneShell() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04070c);
    this.scene.fog = new THREE.FogExp2(0x0a111b, 0.0108);
    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 720);
    this.camera.position.set(0, 1.7, 0);
    this.scene.add(this.camera);
  }

  async initPhysics() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0.0, y: -24.0, z: 0.0 });
    this.RAPIER = RAPIER;
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    for (const cb of this.resizeCallbacks || []) cb();
  }
  onFixedUpdate(cb) { this.fixedUpdateCallbacks.push(cb); }
  onUpdate(cb) { this.updateCallbacks.push(cb); }
  onRender(cb) { this.renderCallbacks.push(cb); }
  onResize(cb) { (this.resizeCallbacks ||= []).push(cb); }
  setRenderFn(fn) { this.renderFn = fn; }
  start() { this.paused = false; this.clock.start(); this.renderer.setAnimationLoop(() => this._tick()); }
  stop() { this.paused = true; }
  _tick() {
    const frameStart = performance.now();
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.paused) return;
    this.accumulator += dt;

    const fixedStart = performance.now();
    let fixedSteps = 0;
    while (this.accumulator >= this.fixedStep) {
      for (const cb of this.fixedUpdateCallbacks) cb(this.fixedStep);
      this.world.step();
      this.accumulator -= this.fixedStep;
      fixedSteps++;
    }
    const fixedEnd = performance.now();

    const alpha = this.accumulator / this.fixedStep;
    const updateStart = fixedEnd;
    for (const cb of this.updateCallbacks) cb(dt, alpha);
    const updateEnd = performance.now();

    const renderStart = updateEnd;
    if (this.renderFn) this.renderFn(dt, alpha); else this.renderer.render(this.scene, this.camera);
    const renderEnd = performance.now();
    for (const cb of this.renderCallbacks) cb(dt, alpha);

    this.perf.frameMs = renderEnd - frameStart;
    this.perf.fixedMs = fixedEnd - fixedStart;
    this.perf.updateMs = updateEnd - updateStart;
    this.perf.renderMs = renderEnd - renderStart;
    this.perf.fixedSteps = fixedSteps;
  }
}
