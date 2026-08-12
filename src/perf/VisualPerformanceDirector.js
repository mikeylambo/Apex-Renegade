import * as THREE from 'three/webgpu';

/**
 * Coordinates rendering/world budgets instead of letting every visual system run
 * at maximum cost all the time. High-speed traversal gets a motion-optimized post
 * path and tighter detail distances. Sustained frame pressure can temporarily
 * suppress the expensive hero-detail layer while preserving the base horizon.
 */
export class VisualPerformanceDirector {
  constructor({ postfx, tuner, bike, bikeWorld }) {
    this.postfx = postfx;
    this.tuner = tuner;
    this.bike = bike;
    this.bikeWorld = bikeWorld;
    this.avgDt = 1 / 60;
    this.stressTimer = 0;
    this.recoveryTimer = 0;
    this.hardStress = false;
    this.motionMode = false;
  }

  update(dt) {
    const sample = Math.min(.08, Math.max(.001, dt));
    this.avgDt = THREE.MathUtils.damp(this.avgDt, sample, 2.6, dt);

    const mounted = !!this.bike?.mounted;
    const speed = Math.abs(Number(this.bike?.speed) || 0);
    const motion = mounted && speed > 7;

    if (this.avgDt > .0255) {
      this.stressTimer += dt;
      this.recoveryTimer = 0;
    } else if (this.avgDt < .0205) {
      this.recoveryTimer += dt;
      this.stressTimer = Math.max(0, this.stressTimer - dt * .5);
    } else {
      this.stressTimer = Math.max(0, this.stressTimer - dt * .15);
      this.recoveryTimer = Math.max(0, this.recoveryTimer - dt * .2);
    }

    if (!this.hardStress && this.stressTimer > 1.1) this.hardStress = true;
    if (this.hardStress && this.recoveryTimer > 2.4) this.hardStress = false;

    const nextMotion = motion || this.hardStress;
    if (nextMotion !== this.motionMode) {
      this.motionMode = nextMotion;
      this.postfx?.setMotionMode?.(nextMotion);
      this.tuner?.setMotionMode?.(nextMotion);
    }

    // Visual Ceiling III is the most micro-detailed additive layer. Under sustained
    // pressure while moving quickly, hide it as a unit; Visual I + IV keep roads,
    // silhouettes, horizons and city massing intact so the downgrade is difficult
    // to notice at speed. Restore it after a stable recovery window.
    const hero = this.bikeWorld?.visualCeilingIII?.root;
    if (hero) hero.visible = !(this.hardStress && mounted && speed > 18);
  }

  getTelemetry() {
    return {
      avgFps: 1 / Math.max(.001, this.avgDt),
      motionMode: this.motionMode,
      hardStress: this.hardStress
    };
  }
}
