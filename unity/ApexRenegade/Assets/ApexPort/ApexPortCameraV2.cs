using Apex.Camera;
using Apex.Combat;
using Apex.Input;
using Apex.Settings;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class ApexPortCameraV2 : MonoBehaviour
    {
        private readonly ApexCameraImpulseState _impulse = new();
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private ApexInputService _input;
        private ApexSettingsService _settings;
        private RenegadeArsenalController _arsenal;
        private HealthComponent _health;
        private float _orbitYaw;
        private float _orbitPitch = 9f;
        private float _lastLookTime = -10f;
        private Vector3 _velocity;
        private float _roll;

        public ApexCameraImpulseState Impulse => _impulse;

        public void Configure(ApexFirstPersonMotor player, ApexBikeMotor bike, ApexInputService input, ApexSettingsService settings)
        {
            if (_bike != null) _bike.BoostStarted -= OnBoostStarted;
            if (_health != null) _health.Damaged -= OnDamaged;
            _player = player;
            _bike = bike;
            _input = input;
            _settings = settings;
            _health = _player != null ? _player.GetComponent<HealthComponent>() : null;
            if (_bike != null) _bike.BoostStarted += OnBoostStarted;
            if (_health != null) _health.Damaged += OnDamaged;
        }

        public void SetArsenal(RenegadeArsenalController arsenal)
        {
            if (_arsenal != null) _arsenal.ShotFired -= OnShotFired;
            _arsenal = arsenal;
            if (_arsenal != null) _arsenal.ShotFired += OnShotFired;
        }

        private void OnShotFired(ApexWeaponRuntime weapon)
        {
            if (weapon == null) return;
            var d = weapon.Definition;
            var maw = d.weaponId == "maw";
            _impulse.Recoil(d.recoilPitch * (maw ? 0.72f : 0.42f), Random.Range(-d.recoilYaw, d.recoilYaw) * 0.65f, maw ? 0.16f : 0.055f);
            if (maw) _impulse.Shake(0.28f, 30f);
        }

        private void OnDamaged(DamagePayload payload, float health, float shield)
        {
            var local = transform.InverseTransformDirection(payload.Direction);
            _impulse.Kick(new Vector3(-local.x * 0.015f, 0f, -0.035f), new Vector3(1.2f, -local.x * 3.2f, local.x * 1.1f));
            _impulse.Shake(0.34f, 24f);
        }

        private void OnBoostStarted()
        {
            _impulse.Kick(new Vector3(0f, 0.01f, -0.08f), new Vector3(1.25f, 0f, 0f));
            _impulse.Shake(0.18f, 32f);
        }

        private void LateUpdate()
        {
            if (Time.timeScale <= 0f) return;
            if (_player == null || _bike == null || _input == null || _settings == null) return;
            var camera = GetComponent<UnityEngine.Camera>();
            if (camera == null) return;

            var dt = Time.unscaledDeltaTime;
            _impulse.Tick(dt, _settings.Data.cameraShake);

            var baseFov = _settings.Data.fov;
            if (!_bike.IsMounted && _arsenal != null && _arsenal.IsAiming && _arsenal.ActiveWeapon != null)
                baseFov = _arsenal.ActiveWeapon.Definition.adsFov;

            var speed01 = _bike.IsMounted ? Mathf.Clamp01(_bike.PlanarSpeed / 78f) : 0f;
            var speedFov = _bike.IsMounted ? speed01 * 11f + (_bike.IsBoosting ? 3.5f : 0f) : 0f;
            camera.fieldOfView = Mathf.Lerp(camera.fieldOfView, baseFov + speedFov, 1f - Mathf.Exp(-8f * dt));

            if (!_bike.IsMounted)
            {
                var view = _player.View;
                if (view == null) return;
                var baseRotation = view.rotation;
                transform.position = view.position + baseRotation * _impulse.Position;
                transform.rotation = baseRotation * Quaternion.Euler(_impulse.RotationEuler);
                _orbitYaw = 0f;
                _orbitPitch = 9f;
                _roll = 0f;
                return;
            }

            var look = _input.ReadLook(dt, false);
            if (look.sqrMagnitude > 0.0001f)
            {
                _orbitYaw += look.x;
                _orbitPitch = Mathf.Clamp(_orbitPitch - look.y, -16f, 50f);
                _lastLookTime = Time.unscaledTime;
            }
            else if (Time.unscaledTime - _lastLookTime > 1.65f)
            {
                _orbitYaw = Mathf.LerpAngle(_orbitYaw, 0f, 1f - Mathf.Exp(-1.55f * dt));
                _orbitPitch = Mathf.Lerp(_orbitPitch, 9f, 1f - Mathf.Exp(-1.55f * dt));
            }

            var move = _input.ReadMove();
            var wheelie = _bike.WheelieAmount;
            var drift = _bike.DriftAmount;
            var pivot = _bike.transform.position
                        + Vector3.up * (1.48f + speed01 * 0.24f + wheelie * 0.65f)
                        + _bike.transform.forward * (wheelie * 0.28f);

            var orbit = Quaternion.Euler(_orbitPitch - wheelie * 3.5f, _bike.transform.eulerAngles.y + _orbitYaw, 0f);
            var distance = 6.4f + speed01 * 4.7f + wheelie * 1.2f;
            var lateralCompose = _bike.transform.right * (-move.x * drift * 0.95f);
            var desired = pivot + orbit * new Vector3(0f, 0.55f - wheelie * 0.22f, -distance) + lateralCompose;
            var basePosition = Vector3.SmoothDamp(
                transform.position,
                desired,
                ref _velocity,
                speed01 > 0.4f ? 0.068f : 0.105f,
                Mathf.Infinity,
                dt);

            var lookAhead = _bike.transform.forward * (4.5f + speed01 * 9f + (_bike.IsBoosting ? 3f : 0f));
            var targetPoint = pivot + lookAhead + Vector3.up * (wheelie * 0.45f);
            var desiredRotation = Quaternion.LookRotation(targetPoint - basePosition, Vector3.up);
            var targetRoll = -move.x * drift * 3.8f;
            _roll = Mathf.Lerp(_roll, targetRoll, 1f - Mathf.Exp(-5.5f * dt));
            desiredRotation *= Quaternion.Euler(0f, 0f, _roll * Mathf.Clamp01(_settings.Data.cameraShake + 0.25f));
            var baseRotation = Quaternion.Slerp(transform.rotation, desiredRotation, 1f - Mathf.Exp(-8.5f * dt));

            transform.position = basePosition + baseRotation * _impulse.Position;
            transform.rotation = baseRotation * Quaternion.Euler(_impulse.RotationEuler);
        }

        private void OnDestroy()
        {
            if (_arsenal != null) _arsenal.ShotFired -= OnShotFired;
            if (_bike != null) _bike.BoostStarted -= OnBoostStarted;
            if (_health != null) _health.Damaged -= OnDamaged;
        }
    }
}
