import * as THREE from 'three/webgpu';

export function installBikeFeelTuning(bike, input) {
  // The procedural bike used to disable frustum culling on every submesh. That
  // made an abandoned bike continue paying draw cost from kilometers away.
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

    // v0.2 launched the bike whenever the character controller briefly lost
    // contact. Keep airtime only when the bike was genuinely climbing a slope.
    if (wasGrounded && !bike.player.grounded) {
      if (riseRate > 1.15 && Math.abs(bike.speed) > 12) {
        bike.player.velocity.y = THREE.MathUtils.clamp(riseRate * .82 + Math.abs(bike.speed) * .018, 1.2, 8.2);
      } else {
        bike.player.velocity.y = Math.min(bike.player.velocity.y, .28);
      }
    }

    // Make wheelies easy to discover on a controller: throttle + pull LS back.
    // The old threshold was high enough that normal trigger/stick calibration
    // often never crossed it, and the visual pitch was too subtle to read.
    const move = input.getMoveAxes();
    const throttle = input.getVehicleAxes().throttle;
    const target = bike.player.grounded && throttle > .42 && move.y > .28 && Math.abs(bike.speed) > 8 ? 1 : 0;
    bike.wheelie = THREE.MathUtils.damp(bike.wheelie, target, target ? 8.5 : 6.5, dt);
  };

  const originalUpdate = bike.update.bind(bike);
  bike.update = (dt) => {
    originalUpdate(dt);
    if (!bike.mounted) return;
    const rider = bike.root.userData.rider;
    const targetPitch = bike.wheelie * .48 + bike.airPitch;
    bike.root.rotation.x = THREE.MathUtils.damp(bike.root.rotation.x, targetPitch, 10, dt);
    bike.root.position.y += bike.wheelie * .12;
    if (rider) rider.rotation.x = THREE.MathUtils.damp(rider.rotation.x, -bike.wheelie * .14, 8, dt);
  };
}

export async function prewarmBikeMountVisuals(engine, postfx, bike) {
  const rider = bike.root.userData.rider;
  if (!rider || !engine.renderer) return;

  const oldPos = bike.root.position.clone();
  const oldRot = bike.root.rotation.clone();
  const oldVisible = rider.visible;
  try {
    // Force the third-person rider/bike through the same WebGPU material and
    // post-processing paths while the boot screen is still covering the canvas.
    // This trades a hidden startup compile for the first-mount hitch seen in play.
    bike.root.position.set(0, 0, -4.5);
    bike.root.rotation.set(0, 0, 0);
    rider.visible = true;
    if (engine.renderer.compileAsync) await engine.renderer.compileAsync(engine.scene, engine.camera);
    else engine.renderer.compile?.(engine.scene, engine.camera);
    postfx?.render?.();
  } catch (err) {
    console.warn('[Apex] Bike visual warmup skipped.', err);
  } finally {
    rider.visible = oldVisible;
    bike.root.position.copy(oldPos);
    bike.root.rotation.copy(oldRot);
  }
}
