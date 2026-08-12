import * as THREE from 'three/webgpu';

export function installBikeFeelTuning(bike, input) {
  bike.root.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });

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

    // Losing contact only becomes a launch when the bike was genuinely climbing.
    // Street seams and hard drifts stay attached to the road.
    if (wasGrounded && !bike.player.grounded) {
      if (riseRate > 1.05 && Math.abs(bike.speed) > 13) {
        bike.player.velocity.y = THREE.MathUtils.clamp(riseRate * .74 + Math.abs(bike.speed) * .014, 1.0, 6.8);
      } else {
        bike.player.velocity.y = Math.min(bike.player.velocity.y, .18);
      }
    }

    // Throttle + pull LS back. Make discovery intentionally generous; the rider
    // can modulate height with stick amount rather than crossing one binary gate.
    const move = input.getMoveAxes();
    const throttle = input.getVehicleAxes().throttle;
    const eligible = bike.player.grounded && throttle > .24 && move.y > .16 && Math.abs(bike.speed) > 5.5;
    const amount = eligible ? THREE.MathUtils.clamp((move.y - .10) / .62, 0, 1) * THREE.MathUtils.clamp((throttle - .16) / .60, 0, 1) : 0;
    bike.wheelie = THREE.MathUtils.damp(bike.wheelie, amount, amount > bike.wheelie ? 10.5 : 6.5, dt);
  };

  const originalUpdate = bike.update.bind(bike);
  bike.update = (dt) => {
    originalUpdate(dt);
    if (!bike.mounted) return;
    const rider = bike.root.userData.rider;
    const targetPitch = bike.wheelie * .72 + bike.airPitch;
    bike.root.rotation.x = THREE.MathUtils.damp(bike.root.rotation.x, targetPitch, 12, dt);
    bike.root.position.y += bike.wheelie * .26;
    if (rider) rider.rotation.x = THREE.MathUtils.damp(rider.rotation.x, -bike.wheelie * .28, 10, dt);
    if (bike.root.userData.spectralLight) bike.root.userData.spectralLight.intensity += bike.wheelie * 1.4;
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
    if (engine.renderer.compileAsync) await engine.renderer.compileAsync(engine.scene, engine.camera);
    else engine.renderer.compile?.(engine.scene, engine.camera);

    // Compile both post paths before the player can mount. The previous warmup
    // only touched the quality graph, so the first runtime pipeline transition
    // could still become a hitch.
    postfx?.setMotionMode?.(false);
    postfx?.render?.();
    postfx?.setMotionMode?.(true);
    postfx?.render?.();
    postfx?.setMotionMode?.(oldMotionMode);
  } catch (err) {
    console.warn('[Apex] Bike visual warmup skipped.', err);
  } finally {
    rider.visible = oldVisible;
    bike.root.position.copy(oldPos);
    bike.root.rotation.copy(oldRot);
  }
}
