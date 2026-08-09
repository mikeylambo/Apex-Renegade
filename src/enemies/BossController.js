import * as THREE from 'three/webgpu';
import { Enemy } from './Enemy.js';
import { bus } from '../core/GameState.js';

/**
 * Boss = Enemy + phase escalation. v1 ships one boss (see levels/arena_graveyard.js
 * bossDef) as a proof of the pattern: each phase threshold bumps aggression
 * so fights have a readable arc instead of a flat DPS race. Add real
 * attack patterns per boss by extending `_attack`.
 */
export class BossController extends Enemy {
  constructor(engine, bossDef, position, playerController) {
    const archetype = {
      id: bossDef.id,
      health: bossDef.health,
      moveSpeed: bossDef.moveSpeed,
      sightRange: 999,
      attackRange: bossDef.attackRange,
      attackDamage: bossDef.attackDamage,
      attackInterval: bossDef.attackInterval,
      scoreValue: bossDef.scoreValue,
      buildMesh: bossDef.buildMesh,
      setHitFlash: bossDef.setHitFlash
    };
    super(engine, archetype, position, playerController);
    this.bossDef = bossDef;
    this.name = bossDef.name;
    this.phase = 0;
    this.fsm.transition('chase');
  }

  takeDamage(amount, hitPoint) {
    super.takeDamage(amount, hitPoint);
    if (this.dead) return;
    const healthPct = this.health / this.maxHealth;
    const nextPhase = this.bossDef.phases.findIndex((p) => healthPct <= p.belowPct);
    if (nextPhase !== -1 && nextPhase !== this.phase) {
      this.phase = nextPhase;
      const p = this.bossDef.phases[nextPhase];
      this.archetype.moveSpeed = this.bossDef.moveSpeed * p.speedMult;
      this.archetype.attackInterval = this.bossDef.attackInterval * p.attackIntervalMult;
      bus.emit('bossPhase', { name: this.bossDef.name, phase: nextPhase });
    }
  }
}
