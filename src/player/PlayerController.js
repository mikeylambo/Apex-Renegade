import * as THREE from 'three/webgpu';
import { GameState } from '../core/GameState.js';

const CFG = {
  radius: 0.35,
  standHeight: 1.7,
  crouchHeight: 1.0,
  eyeOffset: 0.15,
  groundAccel: 14,
  airAccel: 45,
  maxAirWishSpeed: 1.6,
  groundFriction: 8,
  walkSpeed: 6.2,
  sprintSpeed: 9.5,
  crouchSpeed: 3.2,
  jumpSpeed: 8.2,
  gravity: 24,
  dashSpeed: 20,
  dashDuration: 0.16,
  dashCooldown: 0.9,
  wallCheckDist: 0.65,
  wallRunMinSpeed: 4,
  wallRunGravity: 4,
  wallRunMaxTime: 1.4,
  wallJumpUpSpeed: 7.5,
  wallJumpAwaySpeed: 8,
  wallRunCooldown: 0.35,
  slideMinSpeed: 6,
  slideBoost: 3,
  slideFriction: 1.4,
  slideMinDuration: 0.35
};

export class PlayerController {
  constructor(engine, input) {
    this.engine = engine;
    this.input = input;
    const RAPIER = engine.RAPIER;

    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.crouching = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.vehicleMounted = false;

    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashDir = new THREE.Vector3();

    this.wallRunTimer = 0;
    this.wallRunCooldownTimer = 0;
    this.wallNormal = null;
    this.onWall = false;
    this.flightMode = false;
    this._flightTogglePressed = false;

    this.yaw = 0;
    this.pitch = 0;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0);
    this.body = engine.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(
      (CFG.standHeight - CFG.radius * 2) / 2,
      CFG.radius
    ).setTranslation(0, CFG.standHeight / 2, 0);
    this.collider = engine.world.createCollider(colliderDesc, this.body);

    this.characterController = engine.world.createCharacterController(0.02);
    this.characterController.setMaxSlopeClimbAngle((60 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    this.characterController.enableSnapToGround(0.4);
    this.characterController.enableAutostep(0.35, 0.2, true);

    this.currentHeight = CFG.standHeight;
  }

  teleport(position) {
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.velocity.set(0, 0, 0);
  }

  setVehicleMounted(mounted) {
    this.vehicleMounted = mounted;
    if (mounted) {
      this.flightMode = false;
      this.onWall = false;
      this.sliding = false;
      this.crouching = false;
      this.currentHeight = CFG.standHeight;
    }
  }

  get position() {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  updateLook(mouseDelta, sensitivity = 0.0022) {
    this.yaw -= mouseDelta.x * sensitivity;
    this.pitch -= mouseDelta.y * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).negate();
  }

  get right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  fixedUpdate(dt) {
    if (this.vehicleMounted) return;

    const input = this.input;
    const wishDir = new THREE.Vector3();
    if (input.isDown('KeyW')) wishDir.add(this.forward);
    if (input.isDown('KeyS')) wishDir.sub(this.forward);
    if (input.isDown('KeyD')) wishDir.add(this.right);
    if (input.isDown('KeyA')) wishDir.sub(this.right);
    wishDir.y = 0;
    if (wishDir.lengthSq() > 0) wishDir.normalize();

    this._updateFlightToggle(input);
    this._updateCrouchSlide(input, wishDir, dt);
    this._updateDash(input, wishDir, dt);

    if (this.flightMode && GameState.refusalTier >= 3) {
      this._flightMove(input, wishDir, dt);
    } else if (this.dashTimer > 0) {
      const dashScale = 1 + GameState.refusalTier * .12;
      this.velocity.copy(this.dashDir).multiplyScalar(CFG.dashSpeed * dashScale);
    } else if (this.onWall) {
      this._updateWallRun(input, dt);
    } else if (this.grounded) {
      this._groundMove(wishDir, input, dt);
    } else {
      this._airMove(wishDir, dt);
      this._tryWallRun(input, dt);
    }

    if (!this.flightMode && !this.grounded && !this.onWall && this.dashTimer <= 0) this.velocity.y -= CFG.gravity * dt;

    if (!this.flightMode && this.grounded && input.isDown('Space') && this.dashTimer <= 0) {
      this.velocity.y = CFG.jumpSpeed * (1 + GameState.refusalTier * .08);
      this.grounded = false;
    }

    this._move(dt);
    this._tickTimers(dt);
  }

  moveByVehicle(velocity, dt) {
    this.velocity.copy(velocity);
    this.onWall = false;
    this.sliding = false;
    this.flightMode = false;
    this._move(dt);
  }

  _updateFlightToggle(input) {
    const pressed = input.isDown('KeyE');
    if (pressed && !this._flightTogglePressed && GameState.refusalTier >= 3) {
      this.flightMode = !this.flightMode;
      this.onWall = false;
      if (this.flightMode) this.grounded = false;
    }
    if (GameState.refusalTier < 3) this.flightMode = false;
    this._flightTogglePressed = pressed;
  }

  _flightMove(input, wishDir, dt) {
    const tier = GameState.refusalTier;
    const speed = tier >= 4 ? 35 : 25;
    const target = wishDir.clone();
    if (input.isDown('Space')) target.y += 1;
    if (input.isDown('ControlLeft') || input.isDown('KeyC')) target.y -= 1;
    if (target.lengthSq() > 0) target.normalize().multiplyScalar(speed * (input.isDown('ShiftLeft') ? 1.28 : 1));
    this.velocity.lerp(target, 1 - Math.pow(.00035, dt));
    if (target.lengthSq() === 0) this.velocity.multiplyScalar(Math.pow(.055, dt));
  }

  _groundMove(wishDir, input, dt) {
    this.velocity.y = 0;
    let targetSpeed = CFG.walkSpeed;
    if (this.sliding) targetSpeed = this.velocity.length();
    else if (this.crouching) targetSpeed = CFG.crouchSpeed;
    else if (input.isDown('ShiftLeft')) targetSpeed = CFG.sprintSpeed;
    if (GameState.inBlastMode) targetSpeed *= 1.45;
    targetSpeed *= 1 + GameState.refusalTier * .105;

    if (!this.sliding) {
      accelerate(this.velocity, wishDir, targetSpeed, CFG.groundAccel, dt);
      applyFriction(this.velocity, CFG.groundFriction, dt);
    } else applyFriction(this.velocity, CFG.slideFriction, dt);
  }

  _airMove(wishDir, dt) {
    const airAccelMult = 1 + GameState.refusalTier * .16;
    accelerate(this.velocity, wishDir, CFG.maxAirWishSpeed * 30, CFG.airAccel * airAccelMult, dt);
  }

  _updateCrouchSlide(input, wishDir, dt) {
    const wantsCrouch = input.isDown('ControlLeft') || input.isDown('KeyC');
    const sprinting = input.isDown('ShiftLeft');
    const speed = this.velocity.length();

    if (wantsCrouch && this.grounded && !this.sliding && sprinting && speed > CFG.slideMinSpeed) {
      this.sliding = true;
      this.slideTimer = 0;
      this.velocity.addScaledVector(this.velocity.clone().normalize(), CFG.slideBoost);
    }

    if (this.sliding) {
      this.slideTimer += dt;
      const speedNow = this.velocity.length();
      if (!wantsCrouch || (this.slideTimer > CFG.slideMinDuration && speedNow < CFG.crouchSpeed)) this.sliding = false;
    }

    this.crouching = wantsCrouch;
    const targetHeight = (this.crouching || this.sliding) ? CFG.crouchHeight : CFG.standHeight;
    this.currentHeight = THREE.MathUtils.damp(this.currentHeight, targetHeight, 12, dt);
  }

  _updateDash(input, wishDir, dt) {
    if (input._dashPressed === undefined) input._dashPressed = false;
    const dashKey = input.isDown('KeyQ');
    if (dashKey && !input._dashPressed && this.dashCooldownTimer <= 0) {
      const dir = wishDir.lengthSq() > 0 ? wishDir.clone() : this.forward;
      this.dashDir.copy(dir).normalize();
      this.dashTimer = CFG.dashDuration;
      const cooldownMult = Math.max(.46, 1 - GameState.refusalTier * .13);
      this.dashCooldownTimer = CFG.dashCooldown * cooldownMult;
      this.onWall = false;
    }
    input._dashPressed = dashKey;
  }

  _tryWallRun(input, dt) {
    if (this.wallRunCooldownTimer > 0) return;
    if (this.velocity.length() < CFG.wallRunMinSpeed) return;
    if (!(input.isDown('KeyW') || input.isDown('KeyA') || input.isDown('KeyD'))) return;

    const world = this.engine.world;
    const RAPIER = this.engine.RAPIER;
    const pos = this.position;
    const origin = { x: pos.x, y: pos.y + this.currentHeight * 0.5, z: pos.z };

    for (const side of [this.right, this.right.clone().negate()]) {
      const ray = new RAPIER.Ray(origin, { x: side.x, y: 0, z: side.z });
      const hit = world.castRay(ray, CFG.wallCheckDist, true, undefined, undefined, this.collider);
      if (hit) {
        this.onWall = true;
        this.wallNormal = side.clone().negate();
        this.wallRunTimer = 0;
        return;
      }
    }
  }

  _updateWallRun(input, dt) {
    this.wallRunTimer += dt;
    const wishDir = this.forward.clone();
    wishDir.sub(this.wallNormal.clone().multiplyScalar(wishDir.dot(this.wallNormal)));
    if (wishDir.lengthSq() > 0.0001) wishDir.normalize();

    accelerate(this.velocity, wishDir, CFG.sprintSpeed, CFG.groundAccel, dt);
    this.velocity.y -= CFG.wallRunGravity * dt;

    const jumpPressed = input.isDown('Space');
    const maxWallRunTime = CFG.wallRunMaxTime * (1 + GameState.refusalTier * .16);
    const timedOut = this.wallRunTimer > maxWallRunTime;
    if (jumpPressed || timedOut || this.grounded) {
      if (jumpPressed) {
        this.velocity.y = CFG.wallJumpUpSpeed;
        this.velocity.addScaledVector(this.wallNormal, CFG.wallJumpAwaySpeed);
      }
      this.onWall = false;
      this.wallRunCooldownTimer = CFG.wallRunCooldown;
    }
  }

  _move(dt) {
    const desired = this.velocity.clone().multiplyScalar(dt);
    this.characterController.computeColliderMovement(this.collider, { x: desired.x, y: desired.y, z: desired.z });
    const corrected = this.characterController.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + corrected.x, y: t.y + corrected.y, z: t.z + corrected.z });
    this.grounded = this.characterController.computedGrounded();
    if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;
  }

  _tickTimers(dt) {
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.wallRunCooldownTimer > 0) this.wallRunCooldownTimer -= dt;
  }

  getEyePosition() {
    const p = this.position;
    return new THREE.Vector3(p.x, p.y + this.currentHeight - CFG.eyeOffset, p.z);
  }
}

function accelerate(velocity, wishDir, wishSpeed, accel, dt) {
  const currentSpeed = velocity.dot(wishDir);
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) return;
  let accelSpeed = accel * dt * wishSpeed;
  accelSpeed = Math.min(accelSpeed, addSpeed);
  velocity.addScaledVector(wishDir, accelSpeed);
}

function applyFriction(velocity, friction, dt) {
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed < 0.001) { velocity.x = 0; velocity.z = 0; return; }
  const drop = speed * friction * dt;
  const newSpeed = Math.max(speed - drop, 0);
  const scale = newSpeed / speed;
  velocity.x *= scale;
  velocity.z *= scale;
}
