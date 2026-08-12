using Apex.Input;
using Apex.Settings;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class ApexPortCameraV2 : MonoBehaviour
    {
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private ApexInputService _input;
        private ApexSettingsService _settings;
        private RenegadeArsenalController _arsenal;
        private float _orbitYaw;
        private float _orbitPitch = 9f;
        private float _lastLookTime = -10f;
        private Vector3 _velocity;
        private float _roll;

        public void Configure(ApexFirstPersonMotor player, ApexBikeMotor bike, ApexInputService input, ApexSettingsService settings)
        {
            _player = player;
            _bike = bike;
            _input = input;
            _settings = settings;
        }

        public void SetArsenal(RenegadeArsenalController arsenal) => _arsenal = arsenal;

        private void LateUpdate()
        {
            if (_player == null || _bike == null || _input == null || _settings == null) return;
            var camera = GetComponent<Camera>();
            if (camera == null) return;

            var baseFov = _settings.Data.fov;
            if (!_bike.IsMounted && _arsenal != null && _arsenal.IsAiming && _arsenal.ActiveWeapon != null)
                baseFov = _arsenal.ActiveWeapon.Definition.adsFov;

            var speed01 = _bike.IsMounted ? Mathf.Clamp01(_bike.PlanarSpeed / 78f) : 0f;
            var speedFov = _bike.IsMounted ? speed01 * 11f + (_bike.IsBoosting ? 3.5f : 0f) : 0f;
            camera.fieldOfView = Mathf.Lerp(camera.fieldOfView, baseFov + speedFov, 1f - Mathf.Exp(-8f * Time.deltaTime));

            if (!_bike.IsMounted)
            {
                var view = _player.View;
                if (view == null) return;
                transform.SetPositionAndRotation(view.position, view.rotation);
                _orbitYaw = 0f;
                _orbitPitch = 9f;
                _roll = 0f;
                return;
            }

            var look = _input.ReadLook(Time.deltaTime, false);
            if (look.sqrMagnitude > 0.0001f)
            {
                _orbitYaw += look.x;
                _orbitPitch = Mathf.Clamp(_orbitPitch - look.y, -16f, 50f);
                _lastLookTime = Time.unscaledTime;
            }
            else if (Time.unscaledTime - _lastLookTime > 1.65f)
            {
                _orbitYaw = Mathf.LerpAngle(_orbitYaw, 0f, 1f - Mathf.Exp(-1.55f * Time.deltaTime));
                _orbitPitch = Mathf.Lerp(_orbitPitch, 9f, 1f - Mathf.Exp(-1.55f * Time.deltaTime));
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
            transform.position = Vector3.SmoothDamp(
                transform.position,
                desired,
                ref _velocity,
                speed01 > 0.4f ? 0.068f : 0.105f,
                Mathf.Infinity,
                Time.deltaTime);

            var lookAhead = _bike.transform.forward * (4.5f + speed01 * 9f + (_bike.IsBoosting ? 3f : 0f));
            var targetPoint = pivot + lookAhead + Vector3.up * (wheelie * 0.45f);
            var desiredRotation = Quaternion.LookRotation(targetPoint - transform.position, Vector3.up);
            var targetRoll = -move.x * drift * 3.8f;
            _roll = Mathf.Lerp(_roll, targetRoll, 1f - Mathf.Exp(-5.5f * Time.deltaTime));
            desiredRotation *= Quaternion.Euler(0f, 0f, _roll * Mathf.Clamp01(_settings.Data.cameraShake + 0.25f));
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, 1f - Mathf.Exp(-8.5f * Time.deltaTime));
        }
    }
}
