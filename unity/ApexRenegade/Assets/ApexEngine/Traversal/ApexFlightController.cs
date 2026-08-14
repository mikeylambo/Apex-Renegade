using System;
using Apex.Input;
using UnityEngine;

namespace Apex.Traversal
{
    [RequireComponent(typeof(CharacterController), typeof(ApexFirstPersonMotor))]
    public sealed class ApexFlightController : MonoBehaviour
    {
        [SerializeField] private float cruiseSpeed = 18f;
        [SerializeField] private float boostSpeed = 34f;
        [SerializeField] private float acceleration = 32f;
        [SerializeField] private float verticalSpeed = 16f;
        [SerializeField] private float bankDegrees = 7f;

        private CharacterController _controller;
        private ApexFirstPersonMotor _groundMotor;
        private ApexInputService _input;
        private Vector3 _velocity;
        private float _yaw;
        private float _pitch;
        private float _bank;

        public bool IsFlying { get; private set; }
        public Vector3 Velocity => _velocity;
        public event Action<bool> FlightChanged;
        public event Action FlightBoostStarted;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            _groundMotor = GetComponent<ApexFirstPersonMotor>();
            _yaw = transform.eulerAngles.y;
        }

        public void Configure(ApexInputService input) => _input = input;

        public void SetFlight(bool enabled)
        {
            if (IsFlying == enabled) return;
            IsFlying = enabled;
            _velocity = Vector3.zero;
            _yaw = transform.eulerAngles.y;
            _pitch = 0f;
            if (_groundMotor != null) _groundMotor.enabled = !enabled;
            FlightChanged?.Invoke(enabled);
        }

        private void Update()
        {
            if (Time.timeScale <= 0f || _input == null || _groundMotor == null || _bikeMounted()) return;
            if (_input.Pressed(_input.Flight)) SetFlight(!IsFlying);
            if (!IsFlying) return;

            var dt = Time.deltaTime;
            var look = _input.ReadLook(dt, false);
            _yaw += look.x;
            _pitch = Mathf.Clamp(_pitch - look.y, -82f, 82f);
            transform.rotation = Quaternion.Euler(0f, _yaw, 0f);
            if (_groundMotor.View != null) _groundMotor.View.localRotation = Quaternion.Euler(_pitch, 0f, _bank);

            var move = _input.ReadMove();
            var view = _groundMotor.View != null ? _groundMotor.View : transform;
            var forward = Vector3.ProjectOnPlane(view.forward, Vector3.up);
            if (forward.sqrMagnitude < 0.001f) forward = transform.forward;
            forward.Normalize();
            var right = Vector3.Cross(Vector3.up, forward).normalized;
            var vertical = (_input.Held(_input.Jump) ? 1f : 0f) - (_input.Held(_input.Crouch) ? 1f : 0f);
            var wish = forward * move.y + right * move.x + Vector3.up * vertical;
            if (wish.sqrMagnitude > 1f) wish.Normalize();

            var boosting = _input.Held(_input.Sprint) && move.y > 0.1f;
            var speed = boosting ? boostSpeed : cruiseSpeed;
            var target = wish * speed;
            if (Mathf.Abs(vertical) > 0.01f)
            {
                target.y = vertical * verticalSpeed * (boosting ? 1.25f : 1f);
            }
            _velocity = Vector3.MoveTowards(_velocity, target, acceleration * dt);
            if (wish.sqrMagnitude < 0.01f)
                _velocity = Vector3.MoveTowards(_velocity, Vector3.zero, acceleration * 0.65f * dt);

            var targetBank = -move.x * bankDegrees * Mathf.Clamp01(_velocity.magnitude / cruiseSpeed);
            _bank = Mathf.Lerp(_bank, targetBank, 1f - Mathf.Exp(-5f * dt));
            if (_groundMotor.View != null) _groundMotor.View.localRotation = Quaternion.Euler(_pitch, 0f, _bank);

            _controller.Move(_velocity * dt);
        }

        private bool _lastBoost;
        private bool _bikeMounted()
        {
            // A disabled ground motor is also how the bike temporarily owns the player,
            // but flight itself owns that same disable while active. Detect a mounted bike
            // by looking for the mountable currently holding this motor.
            var bike = UnityEngine.Object.FindFirstObjectByType<ApexBikeMotor>();
            var mounted = bike != null && bike.IsMounted && bike.Rider == _groundMotor;
            if (mounted && IsFlying) SetFlight(false);

            if (IsFlying && !mounted && _input != null)
            {
                var boosting = _input.Held(_input.Sprint) && _input.ReadMove().y > 0.1f;
                if (boosting && !_lastBoost) FlightBoostStarted?.Invoke();
                _lastBoost = boosting;
            }
            else _lastBoost = false;
            return mounted;
        }
    }
}
