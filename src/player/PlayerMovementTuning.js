import { GameState } from '../core/GameState.js';

/**
 * World Spine movement tuning. The original controller remains intact; this
 * clamps only grounded locomotion so early-game scale reads properly while
 * keeping dash, slide, wall movement, air control and later Refusal escalation
 * aggressive.
 */
export function installPlayerMovementTuning(player, input) {
  if (player.__apexMovementTuned) return;
  player.__apexMovementTuned = true;
  const baseGroundMove = player._groundMove.bind(player);

  player._groundMove = (wishDir, inputManager, dt) => {
    baseGroundMove(wishDir, inputManager, dt);
    if (player.sliding) return;

    let cap = 5.25;
    if (player.crouching) cap = 3.0;
    else if (input.isDown('ShiftLeft')) cap = 7.9;
    if (GameState.inBlastMode) cap *= 1.45;
    cap *= 1 + GameState.refusalTier * .09;

    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    if (speed <= cap || speed < .001) return;
    const scale = cap / speed;
    player.velocity.x *= scale;
    player.velocity.z *= scale;
  };
}
