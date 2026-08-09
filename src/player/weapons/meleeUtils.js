import * as THREE from 'three/webgpu';

export function meleeArcAttack(ws, { range, arc, damage }) {
  const camDir = new THREE.Vector3();
  ws.camera.getWorldDirection(camDir);
  const origin = ws.camera.getWorldPosition(new THREE.Vector3());
  const targets = ws.enemyManager.getHittableObjects();
  let hitAny = false;
  for (const obj of targets) {
    const target = obj.userData.damageable;
    if (!target || target.dead) continue;
    const toTarget = new THREE.Vector3().subVectors(obj.getWorldPosition(new THREE.Vector3()), origin);
    const dist = toTarget.length();
    if (dist > range) continue;
    const angle = camDir.angleTo(toTarget.normalize());
    if (angle > arc) continue;
    target.takeDamage(damage, obj.position.clone());
    hitAny = true;
  }
  return hitAny;
}
