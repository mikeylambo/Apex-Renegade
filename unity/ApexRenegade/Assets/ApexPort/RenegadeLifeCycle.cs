using System.Collections;
using Apex.Combat;
using Apex.Save;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeLifeCycle : MonoBehaviour
    {
        private HealthComponent _health;
        private ApexFirstPersonMotor _motor;
        private ApexSaveService _save;
        private ApexBikeMotor _bike;
        private bool _respawning;
        public float LastDamageTime { get; private set; } = -10f;
        public Vector3 LastDamageDirection { get; private set; }
        public bool IsRespawning => _respawning;

        public void Configure(HealthComponent health, ApexFirstPersonMotor motor, ApexSaveService save, ApexBikeMotor bike)
        {
            if (_health != null)
            {
                _health.Died -= OnDied;
                _health.Damaged -= OnDamaged;
            }
            _health = health;
            _motor = motor;
            _save = save;
            _bike = bike;
            if (_health != null)
            {
                _health.Died += OnDied;
                _health.Damaged += OnDamaged;
            }
        }

        private void OnDamaged(DamagePayload payload, float health, float shield)
        {
            LastDamageTime = Time.unscaledTime;
            LastDamageDirection = payload.Direction;
        }

        private void OnDied()
        {
            if (!_respawning) StartCoroutine(RespawnRoutine());
        }

        private IEnumerator RespawnRoutine()
        {
            _respawning = true;
            if (_bike != null && _bike.IsMounted) _bike.Dismount();
            if (_motor != null) _motor.enabled = false;
            yield return new WaitForSecondsRealtime(1.15f);

            if (_motor != null)
            {
                if (_save != null && _save.TryGetRespawn(out var position, out var rotation))
                    _motor.Teleport(position + Vector3.up * 0.15f, rotation);
                else
                    _motor.Teleport(new Vector3(0f, 2.2f, 525f), Quaternion.identity);
            }

            _health?.ResetVitals();
            if (_motor != null) _motor.enabled = true;
            _respawning = false;
        }

        private void OnDestroy()
        {
            if (_health != null)
            {
                _health.Died -= OnDied;
                _health.Damaged -= OnDamaged;
            }
        }
    }
}
