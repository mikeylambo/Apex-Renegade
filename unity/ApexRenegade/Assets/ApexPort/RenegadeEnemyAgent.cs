using System;
using System.Collections;
using Apex.AI;
using Apex.Combat;
using UnityEngine;

namespace Apex.Renegade
{
    public interface IRenegadeHitReactive
    {
        void NotifyHit(Vector3 point, Vector3 direction);
    }

    [RequireComponent(typeof(CharacterController), typeof(HealthComponent), typeof(ApexAgentMotor))]
    public sealed class RenegadeEnemyAgent : MonoBehaviour, IAimAssistTarget, IRenegadeHitReactive
    {
        private CharacterController _controller;
        private HealthComponent _health;
        private ApexAgentMotor _motor;
        private Transform _target;
        private Material _material;
        private Color _baseColor;
        private bool _enforcer;
        private float _flashUntil;
        private float _attackDamage;
        private float _aimPriority;

        public string ArchetypeId => _enforcer ? "enforcer" : "hollow";
        public bool AimAssistEligible => _health != null && _health.IsAlive && isActiveAndEnabled;
        public Vector3 AimAssistPoint => transform.position + Vector3.up * (_enforcer ? 1.7f : 1.25f);
        public float AimAssistPriority => _aimPriority;
        public HealthComponent Health => _health;
        public ApexAgentMotor Motor => _motor;
        public event Action<RenegadeEnemyAgent> Killed;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            _health = GetComponent<HealthComponent>();
            _motor = GetComponent<ApexAgentMotor>();
            _health.Died += OnDied;
            _health.Damaged += OnDamaged;
            _motor.AttackRequested += OnAttackRequested;
        }

        public void Configure(Transform target, bool enforcer, Material material)
        {
            _target = target;
            _enforcer = enforcer;
            _material = material;
            if (_material != null) _baseColor = _material.color;

            if (_enforcer)
            {
                _health.Configure(190f, 35f);
                _attackDamage = 16f;
                _aimPriority = 1f;
                _motor.Configure(target, new ApexAgentTuning
                {
                    moveSpeed = 3.15f,
                    acceleration = 9f,
                    turnSharpness = 5.2f,
                    attackRange = 19f,
                    preferredRange = 13f,
                    attackInterval = 1.25f,
                    gravity = 22f
                });
            }
            else
            {
                _health.Configure(82f, 0f);
                _attackDamage = 8f;
                _aimPriority = 0.72f;
                _motor.Configure(target, ApexAgentTuning.Default);
            }
        }

        private void OnAttackRequested(ApexAgentAttackRequest request)
        {
            if (_health == null || !_health.IsAlive || request.Target == null) return;
            var targetHealth = request.Target.GetComponent<HealthComponent>();
            if (targetHealth == null || !targetHealth.IsAlive) return;
            var kind = _enforcer ? DamageKind.Impact : DamageKind.Energy;
            var point = request.Target.position + Vector3.up * 1.1f;
            targetHealth.ApplyDamage(new DamagePayload(_attackDamage, point, request.Direction, kind, gameObject));
        }

        public void NotifyHit(Vector3 point, Vector3 direction)
        {
            if (_motor == null) return;
            _motor.Stagger(direction, _enforcer ? 1.25f : 2.7f, _enforcer ? 0.10f : 0.19f);
        }

        private void OnDamaged(DamagePayload payload, float health, float shield)
        {
            if (_material == null) return;
            _material.color = Color.Lerp(_baseColor, Color.white, _enforcer ? 0.48f : 0.72f);
            _flashUntil = Time.unscaledTime + (_enforcer ? 0.04f : 0.06f);
        }

        private void Update()
        {
            if (_material != null && Time.unscaledTime >= _flashUntil && _material.color != _baseColor)
                _material.color = _baseColor;
        }

        private void OnDied()
        {
            Killed?.Invoke(this);
            StartCoroutine(DeathRoutine());
        }

        private IEnumerator DeathRoutine()
        {
            var start = transform.localScale;
            var duration = _enforcer ? 0.62f : 0.43f;
            var elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                var t = Mathf.Clamp01(elapsed / duration);
                var pulse = 1f + Mathf.Sin(t * Mathf.PI) * (_enforcer ? 0.14f : 0.08f);
                transform.localScale = new Vector3(start.x * pulse, start.y * (1f - t * 0.93f), start.z * pulse);
                yield return null;
            }
            if (_controller != null) _controller.enabled = false;
            gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (_health != null)
            {
                _health.Died -= OnDied;
                _health.Damaged -= OnDamaged;
            }
            if (_motor != null) _motor.AttackRequested -= OnAttackRequested;
        }
    }
}
