using System.Collections;
using Apex.Combat;
using Apex.Core;
using Apex.Input;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeHapticsBridge : MonoBehaviour
    {
        private ApexHapticsService _haptics;
        private RenegadeArsenalController _arsenal;
        private ApexBikeMotor _bike;
        private HealthComponent _health;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureBridge()
        {
            if (Object.FindFirstObjectByType<RenegadeHapticsBridge>() != null) return;
            new GameObject("Apex Haptics Bridge").AddComponent<RenegadeHapticsBridge>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 120; i++)
            {
                if (ApexRuntime.IsInitialized &&
                    ApexRuntime.Services.TryGet<ApexHapticsService>(out var haptics) &&
                    Object.FindFirstObjectByType<RenegadeArsenalController>() is { } arsenal &&
                    Object.FindFirstObjectByType<ApexBikeMotor>() is { } bike &&
                    Object.FindFirstObjectByType<ApexFirstPersonMotor>() is { } player)
                {
                    Configure(haptics, arsenal, bike, player.GetComponent<HealthComponent>());
                    yield break;
                }
                yield return null;
            }
        }

        public void Configure(ApexHapticsService haptics, RenegadeArsenalController arsenal, ApexBikeMotor bike, HealthComponent health)
        {
            _haptics = haptics;
            _arsenal = arsenal;
            _bike = bike;
            _health = health;

            if (_arsenal != null)
            {
                _arsenal.ShotFired += OnShot;
                _arsenal.HitConfirmed += OnHit;
            }
            if (_bike != null)
            {
                _bike.Mounted += OnMount;
                _bike.RecallStarted += OnRecall;
                _bike.BoostStarted += OnBoost;
            }
            if (_health != null) _health.Damaged += OnDamaged;
        }

        private void OnShot(ApexWeaponRuntime weapon)
        {
            if (weapon?.Definition.weaponId == "maw") _haptics?.Pulse(0.72f, 0.95f, 0.13f);
            else _haptics?.Pulse(0.16f, 0.32f, 0.045f);
        }

        private void OnHit(Vector3 point, bool killed) => _haptics?.Pulse(killed ? 0.38f : 0.12f, killed ? 0.68f : 0.28f, killed ? 0.095f : 0.045f);
        private void OnDamaged(DamagePayload payload, float health, float shield) => _haptics?.Pulse(0.66f, 0.48f, 0.14f);
        private void OnMount() => _haptics?.Pulse(0.18f, 0.35f, 0.09f);
        private void OnRecall() => _haptics?.Pulse(0.12f, 0.42f, 0.12f);
        private void OnBoost() => _haptics?.Pulse(0.32f, 0.72f, 0.12f);

        private void OnDestroy()
        {
            if (_arsenal != null)
            {
                _arsenal.ShotFired -= OnShot;
                _arsenal.HitConfirmed -= OnHit;
            }
            if (_bike != null)
            {
                _bike.Mounted -= OnMount;
                _bike.RecallStarted -= OnRecall;
                _bike.BoostStarted -= OnBoost;
            }
            if (_health != null) _health.Damaged -= OnDamaged;
        }
    }
}
