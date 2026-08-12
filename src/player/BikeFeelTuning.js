import * as THREE from 'three/webgpu';

export function installBikeFeelTuning(bike, input) {
  bike.root.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });

  // Mount is intentionally synchronous. This diagnostic tells us whether a future
  // hitch is the mount code itself or rendering work that happens on the next frame.
  const originalMount = bike.mount.bind(bike);
  bike.mount = () => {
    const t0 = performance.now();
    originalMount();
    const syncMs = performance.now() - t0;
    requestAnimationFrame(() => {
      const presentedMs = performance.now() - t0;
      console.info(`[Apex Perf] bike mount sync ${syncMs.toFixed(1)}ms // next frame ${presentedMs.toFixed(1)}ms`);
    });
  };

  let riseRate = 0;
  const originalFixed = bike.fixedUpdate.bind(bike);
  bike.fixedUpdate = (dt) => {
    if (!bike.mounted) { originalFixed(dt); return; }
    const wasGrounded = bike.player.grounded;
    const y0 = bike.player.position.y;

    originalFixed(dt);

    const y1 = bike.player.position.y;
    const rawRise = (y1 - y0) / Math.max(.001, dt);
    if (wasGrounded) riseRate = THREE.MathUtils.damp(riseRate, Math.max(0, rawRise), 10, dt);
    else riseRate = THREE.MathUtils.damp(riseRate, 0, 5, dt);

    if (wasGrounded && !bike.player.grounded) {
      if (riseRate > 1.05 && Math.abs(bike.speed) > 13) {
        bike.player.velocity.y = THREE.MathUtils.clamp(riseRate * .74 + Math.abs(bike.speed) * .014, 1.0, 6.8);
      } else {
        bike.player.velocity.y = Math.min(bike.player.velocity.y, .18);
      }
    }

    // Throttle + pull LS back. Make the front lift unmistakably readable while
    // keeping it analog rather than turning wheelie into a canned animation.
    const move = input.getMoveAxes();
    const throttle = input.getVehicleAxes().throttle;
    const eligible = bike.player.grounded && throttle > .18 && move.y > .12 && Math.abs(bike.speed) > 4.0;
    const amount = eligible
      ? THREE.MathUtils.clamp((move.y - .06) / .58, 0, 1) * THREE.MathUtils.clamp((throttle - .10) / .56, 0, 1)
      : 0;
    bike.wheelie = THREE.MathUtils.damp(bike.wheelie, amount, amount > bike.wheelie ? 13 : 7, dt);
  };

  const originalUpdate = bike.update.bind(bike);
  bike.update = (dt) => {
    originalUpdate(dt);
    if (!bike.mounted) return;
    const rider = bike.root.userData.rider;
    const targetPitch = bike.wheelie * .94 + bike.airPitch;
    bike.root.rotation.x = THREE.MathUtils.damp(bike.root.rotation.x, targetPitch, 18, dt);
    bike.root.position.y += bike.wheelie * .36;
    if (rider) rider.rotation.x = THREE.MathUtils.damp(rider.rotation.x, -bike.wheelie * .36, 12, dt);
    if (bike.root.userData.spectralLight) bike.root.userData.spectralLight.intensity += bike.wheelie * 2.0;
  };
}

export async function prewarmBikeMountVisuals(engine, postfx, bike) {
  const rider = bike.root.userData.rider;
  if (!rider || !engine.renderer) return;

  const oldPos = bike.root.position.clone();
  const oldRot = bike.root.rotation.clone();
  const oldVisible = rider.visible;
  const oldMotionMode = !!postfx?.motionMode;
  try {
    bike.root.position.set(0, 0, -4.5);
    bike.root.rotation.set(0, 0, 0);
    rider.visible = true;

    // IMPORTANT: call this only after the level and visual layers exist. Compiling
    // before world construction cannot warm the materials/pipelines that caused
    // the first high-speed bike hitch in Visual Ceiling IV.
    if (engine.renderer.compileAsync) await engine.renderer.compileAsync(engine.scene, engine.camera);
    else engine.renderer.compile?.(engine.scene, engine.camera);

    postfx?.setMotionMode?.(false);
    postfx?.render?.();
    postfx?.setMotionMode?.(true);
    postfx?.render?.();
    postfx?.setMotionMode?.(oldMotionMode);
  } catch (err) {
    console.warn('[Apex] Bike/world visual warmup skipped.', err);
  } finally {
    rider.visible = oldVisible;
    bike.root.position.copy(oldPos);
    bike.root.rotation.copy(oldRot);
  }
}
