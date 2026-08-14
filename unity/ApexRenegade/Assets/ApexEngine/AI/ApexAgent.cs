using System;
using Apex.Combat;
using UnityEngine;

namespace Apex.AI
{
    public enum ApexAgentState { Dormant, Pursuing, Attacking, Staggered, Dead }

    [Serializable]
    public struct ApexAgentTuning
    {
        public float moveSpeed;
        public float acceleration;
        public float turnSharpness;
        public float attackRange;
        public float preferredRange;
        public float attackInterval;
        public float gravity;

        public static ApexAgentTuning Default => new()
        {
            moveSpeed = 4.1f,
            acceleration = 14f,
            turnSharpness = 7f,
            attackRange = 13f,
            preferredRange = 8.5f,
            attackInterval = 0.92f,
            gravity = 22f
        };

        public void Sanitize()
        {
            moveSpeed = Mathf.Max(0f, moveSpeed);
            acceleration = Mathf.Max(0.1f, acceleration);
            turnSharpness = Mathf.Max(0.1f, turnSharpness);
            attackRange = Mathf.Max(0.1f, attackRange);
            preferredRange = Mathf.Clamp(preferredRange, 0.1f, attackRange);
            attackInterval = Mathf.Max(0.05f, attackInterval);
            gravity = Mathf.Max(0f, gravity);
        }
    }

    public readonly struct ApexAgentAttackRequest
    {
        public readonly Transform Target;
        public readonly float Distance;
        public readonly Vector3 Direction;

        public ApexAgentAttackRequest(Transform target, float distance, Vector3 direction)
        {
            Target = target;
            Distance = distance;
            Direction = direction;
        }
    }

    [RequireComponent(typeof(CharacterController))]
    public sealed class ApexAgentMotor : MonoBehaviour
    {
        [SerializeField] private ApexAgentTuning tuning = default;
        private CharacterController _controller;
        private HealthComponent _health;
        private Transform _target;
        private Vector3 _planarVelocity;
        private float _verticalVelocity;
        private Vector3 _staggerVelocity;
        private float _staggerUntil;
        private float _nextAttack;

        public ApexAgentState State { get; private set; } = ApexAgentState.Dormant;
        public Transform Target => _target;
        public ApexAgentTuning Tuning => tuning;
        public Vector3 Velocity => _planarVelocity + Vector3.up * _verticalVelocity + _staggerVelocity;

        public event Action<ApexAgentState> StateChanged;
        public event Action<ApexAgentAttackRequest> AttackRequested;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            _health = GetComponent<HealthComponent>();
            if (tuning.moveSpeed <= 0f) tuning = ApexAgentTuning.Default;
            tuning.Sanitize();
            if (_health != null) _health.Died += OnDied;
        }

        public void Configure(Transform target, ApexAgentTuning agentTuning)
        {
            _target = target;
            tuning = agentTuning;
            tuning.Sanitize();
            SetState(_target != null ? ApexAgentState.Pursuing : ApexAgentState.Dormant);
        }

        public void SetTarget(Transform target)
        {
            _target = target;
            if (State != ApexAgentState.Dead)
                SetState(_target != null ? ApexAgentState.Pursuing : ApexAgentState.Dormant);
        }

        public void Stagger(Vector3 direction, float impulse, float duration = 0.18f)
        {
            if (State == ApexAgentState.Dead) return;
            var planar = Vector3.ProjectOnPlane(direction, Vector3.up);
            if (planar.sqrMagnitude > 0.0001f) planar.Normalize();
            _staggerVelocity += planar * Mathf.Max(0f, impulse);
            _staggerUntil = Mathf.Max(_staggerUntil, Time.time + Mathf.Max(0.03f, duration));
            SetState(ApexAgentState.Staggered);
        }

        private void Update()
        {
            if (Time.timeScale <= 0f || State == ApexAgentState.Dead || _controller == null || !_controller.enabled) return;
            var dt = Time.deltaTime;

            if (_controller.isGrounded) _verticalVelocity = -1.5f;
            else _verticalVelocity -= tuning.gravity * dt;

            _staggerVelocity = Vector3.Lerp(_staggerVelocity, Vector3.zero, 1f - Mathf.Exp(-11f * dt));
            if (Time.time < _staggerUntil)
            {
                _controller.Move((_staggerVelocity + Vector3.up * _verticalVelocity) * dt);
                return;
            }

            if (_target == null)
            {
                _planarVelocity = Vector3.Lerp(_planarVelocity, Vector3.zero, 1f - Mathf.Exp(-tuning.acceleration * dt));
                SetState(ApexAgentState.Dormant);
                _controller.Move((_planarVelocity + Vector3.up * _verticalVelocity) * dt);
                return;
            }

            var to = _target.position - transform.position;
            var planarTo = Vector3.ProjectOnPlane(to, Vector3.up);
            var distance = planarTo.magnitude;
            var direction = distance > 0.001f ? planarTo / distance : transform.forward;

            if (planarTo.sqrMagnitude > 0.001f)
            {
                var targetRotation = Quaternion.LookRotation(direction, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, 1f - Mathf.Exp(-tuning.turnSharpness * dt));
            }

            if (distance > tuning.preferredRange)
            {
                SetState(ApexAgentState.Pursuing);
                var desiredVelocity = direction * tuning.moveSpeed;
                _planarVelocity = Vector3.Lerp(_planarVelocity, desiredVelocity, 1f - Mathf.Exp(-tuning.acceleration * dt));
            }
            else _planarVelocity = Vector3.Lerp(_planarVelocity, Vector3.zero, 1f - Mathf.Exp(-tuning.acceleration * 1.4f * dt));

            if (distance <= tuning.attackRange && Time.time >= _nextAttack)
            {
                _nextAttack = Time.time + tuning.attackInterval;
                SetState(ApexAgentState.Attacking);
                AttackRequested?.Invoke(new ApexAgentAttackRequest(_target, distance, direction));
            }
            else if (State == ApexAgentState.Attacking && distance > tuning.preferredRange)
                SetState(ApexAgentState.Pursuing);

            _controller.Move((_planarVelocity + _staggerVelocity + Vector3.up * _verticalVelocity) * dt);
        }

        private void OnDied()
        {
            _planarVelocity = Vector3.zero;
            _staggerVelocity = Vector3.zero;
            SetState(ApexAgentState.Dead);
        }

        private void SetState(ApexAgentState next)
        {
            if (State == next) return;
            State = next;
            StateChanged?.Invoke(State);
        }

        private void OnDestroy()
        {
            if (_health != null) _health.Died -= OnDied;
        }
    }
}
