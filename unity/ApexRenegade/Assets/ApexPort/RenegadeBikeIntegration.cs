using System.Collections;
using Apex.Combat;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(250)]
    public sealed class RenegadeMountedBodyFollower : MonoBehaviour
    {
        private ApexBikeMotor _bike;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureFollower()
        {
            if (Object.FindFirstObjectByType<RenegadeMountedBodyFollower>() != null) return;
            new GameObject("Apex Mounted Actor Follower").AddComponent<RenegadeMountedBodyFollower>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 60 && _bike == null; i++)
            {
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                yield return null;
            }
        }

        private void LateUpdate()
        {
            if (_bike == null || !_bike.IsMounted || _bike.Rider == null) return;
            var rider = _bike.Rider.transform;
            rider.SetPositionAndRotation(_bike.transform.position + Vector3.up * 0.55f, _bike.transform.rotation);
        }
    }

    [RequireComponent(typeof(ApexBikeMotor), typeof(Rigidbody))]
    public sealed class RenegadeBikeImpactCombat : MonoBehaviour
    {
        private ApexBikeMotor _bike;
        private float _nextImpactTime;

        private void Awake() => _bike = GetComponent<ApexBikeMotor>();

        private void OnCollisionEnter(Collision collision)
        {
            if (_bike == null || !_bike.IsMounted || Time.time < _nextImpactTime) return;
            var speed = _bike.PlanarSpeed;
            if (speed < 8f) return;

            var target = collision.collider.GetComponentInParent<HealthComponent>();
            if (target == null || !target.IsAlive) return;
            var riderHealth = _bike.Rider != null ? _bike.Rider.GetComponent<HealthComponent>() : null;
            if (target == riderHealth) return;

            var point = collision.contactCount > 0 ? collision.GetContact(0).point : collision.collider.bounds.center;
            var direction = Vector3.ProjectOnPlane(transform.forward, Vector3.up).normalized;
            var speed01 = Mathf.InverseLerp(8f, 65f, speed);
            var driftBonus = Mathf.Lerp(1f, 1.8f, _bike.DriftAmount);
            var boostBonus = _bike.IsBoosting ? 1.35f : 1f;
            var damage = Mathf.Lerp(12f, 88f, speed01) * driftBonus * boostBonus;
            target.ApplyDamage(new DamagePayload(damage, point, direction, DamageKind.Impact, _bike.Rider?.gameObject));

            if (collision.rigidbody != null && !collision.rigidbody.isKinematic)
                collision.rigidbody.AddForce(direction * Mathf.Lerp(3f, 18f, speed01), ForceMode.Impulse);
            _nextImpactTime = Time.time + 0.16f;
        }
    }

    public sealed class RenegadeBikeCombatInstaller : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureInstaller()
        {
            if (Object.FindFirstObjectByType<RenegadeBikeCombatInstaller>() != null) return;
            new GameObject("Apex Bike Combat Installer").AddComponent<RenegadeBikeCombatInstaller>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 60; i++)
            {
                var bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                if (bike != null)
                {
                    if (bike.GetComponent<RenegadeBikeImpactCombat>() == null)
                        bike.gameObject.AddComponent<RenegadeBikeImpactCombat>();
                    yield break;
                }
                yield return null;
            }
        }
    }
}
