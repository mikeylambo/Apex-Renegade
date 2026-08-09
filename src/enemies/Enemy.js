import * as THREE from 'three/webgpu';
import { StateMachine } from '../core/StateMachine.js';
import { bus, GameState } from '../core/GameState.js';

export class Enemy {
  constructor(engine, archetype, position, playerController) {
    this.engine = engine;
    this.archetype = archetype;
    this.player = playerController;
    this.dead = false;
    this.health = archetype.health;
    this.maxHealth = archetype.health;

    this.mesh = archetype.buildMesh();
    this.mesh.position.copy(position);
    this.mesh.userData.damageable = this;
    this.mesh.traverse((child) => { if (child.isMesh) child.userData.damageable = this; });
    engine.scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this.attackTimer = 0;
    this.hitFlashTimer = 0;
    this.hitImpulse = 0;
    this.deathTimer = 0;
    this._reinforcementCd = 0;
    this.onRequestReinforcement = null;

    this.fsm = new StateMachine({
      idle: { update: () => { if (this._canSeePlayer(this.archetype.sightRange)) this.fsm.transition('chase'); } },
      chase: { update: (dt) => this._chase(dt) },
      attack: { enter: () => { this.attackTimer = 0; }, update: (dt) => this._attack(dt) },
      flee: { enter: () => { this._fleeTimer = 0; }, update: (dt) => this._flee(dt) },
      dead: { enter: () => this._onDeath() }
    }, 'idle');
  }

  _canSeePlayer(range) { return this.mesh.position.distanceTo(this.player.position) <= range; }

  _chase(dt) {
    const toPlayer = new THREE.Vector3().subVectors(this.player.position, this.mesh.position);
    const dist = toPlayer.length();
    if (dist <= this.archetype.attackRange) { this.fsm.transition('attack'); return; }
    toPlayer.y = 0;
    toPlayer.normalize();
    this.velocity.lerp(toPlayer.multiplyScalar(this.archetype.moveSpeed), 1 - Math.pow(0.001, dt));
    this.mesh.position.addScaledVector(this.velocity, dt);
    this.mesh.lookAt(this.player.position.x, this.mesh.position.y, this.player.position.z);
    if (dist > this.archetype.sightRange * 1.6) this.fsm.transition('idle');
  }

  _attack(dt) {
    const dist = this.mesh.position.distanceTo(this.player.position);
    if (dist > this.archetype.attackRange * 1.3) { this.fsm.transition('chase'); return; }
    this.mesh.lookAt(this.player.position.x, this.mesh.position.y, this.player.position.z);
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = this.archetype.attackInterval;
      GameState.damagePlayer(this.archetype.attackDamage);
      bus.emit('enemyAttack', { archetype: this.archetype.id });
    }
    if (this._reinforcementCd > 0) this._reinforcementCd -= dt;
    if (this.archetype.callsReinforcements && GameState.ferocityTier >= 2 && this._reinforcementCd <= 0 && this.onRequestReinforcement) {
      this._reinforcementCd = 7;
      this.onRequestReinforcement();
      bus.emit('reinforcementCalled', { archetype: this.archetype.id });
    }
  }

  _flee(dt) {
    const away = new THREE.Vector3().subVectors(this.mesh.position, this.player.position);
    away.y = 0;
    if (away.lengthSq() < 0.0001) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    away.normalize();
    this.velocity.lerp(away.multiplyScalar(this.archetype.moveSpeed * 1.3), 1 - Math.pow(0.001, dt));
    this.mesh.position.addScaledVector(this.velocity, dt);
    this.mesh.lookAt(this.mesh.position.x + this.velocity.x, this.mesh.position.y, this.mesh.position.z + this.velocity.z);
    this._fleeTimer += dt;
    if (this._fleeTimer > 6 || GameState.ferocityTier < 1) this.fsm.transition('idle');
  }

  takeDamage(amount, hitPoint) {
    if (this.dead) return;
    this.health -= amount;
    this.hitFlashTimer = 0.08;
    this.hitImpulse = 1;
    this.velocity.multiplyScalar(.48);
    GameState.addBlastCharge(amount * 0.35);
    bus.emit('enemyHit', { enemy: this, amount, hitPoint });
    if (this.health <= 0) {
      this.dead = true;
      this.fsm.transition('dead');
      return;
    }
    if (this.archetype.fleesAtHighFerocity && GameState.ferocityTier >= 1 && !this.fsm.is('flee')) this.fsm.transition('flee');
  }

  _onDeath() {
    GameState.registerKill(this.archetype.scoreValue);
    this.deathTimer = .34;
    this.hitImpulse = 1.35;
    bus.emit('enemyDied', { archetype: this.archetype.id, position: this.mesh.position.clone() });
  }

  update(dt) {
    if (this.dead) {
      this.deathTimer -= dt;
      const t = Math.max(0, this.deathTimer / .34);
      this.mesh.scale.setScalar(Math.max(.06, t));
      this.mesh.rotation.z += dt * 5.4;
      this.mesh.position.y = Math.max(.08, this.mesh.position.y - dt * .9);
      if (this.deathTimer <= 0) this.engine.scene.remove(this.mesh);
      return;
    }
    this.fsm.update(dt);
    this.hitImpulse = THREE.MathUtils.damp(this.hitImpulse, 0, 15, dt);
    this.mesh.scale.setScalar(1 + this.hitImpulse * .045);
    this.mesh.rotation.z = Math.sin(performance.now() * .035) * this.hitImpulse * .08;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      this.archetype.setHitFlash(this.mesh, this.hitFlashTimer > 0);
    }
  }

  getHitObjects() {
    const objs = [];
    this.mesh.traverse((c) => { if (c.isMesh) objs.push(c); });
    return objs;
  }
}
