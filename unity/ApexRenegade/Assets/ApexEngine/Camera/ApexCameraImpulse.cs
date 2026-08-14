using UnityEngine;

namespace Apex.CameraSystem
{
    public sealed class ApexCameraImpulseState
    {
        private Vector3 _position;
        private Vector3 _rotation;
        private Vector3 _positionVelocity;
        private Vector3 _rotationVelocity;
        private float _noiseAmplitude;
        private float _noiseFrequency = 26f;
        private float _noisePhase;

        public Vector3 Position => _position;
        public Vector3 RotationEuler => _rotation;
        public bool Active => _position.sqrMagnitude > 0.000001f || _rotation.sqrMagnitude > 0.000001f || _noiseAmplitude > 0.0001f;

        public void Kick(Vector3 positionImpulse, Vector3 rotationImpulse)
        {
            _positionVelocity += positionImpulse;
            _rotationVelocity += rotationImpulse;
        }

        public void Recoil(float pitch, float yaw, float backward)
        {
            Kick(new Vector3(0f, 0.006f * Mathf.Abs(pitch), -Mathf.Abs(backward)),
                new Vector3(-Mathf.Abs(pitch), yaw, 0f));
        }

        public void Shake(float amplitude, float frequency = 26f)
        {
            _noiseAmplitude = Mathf.Max(_noiseAmplitude, Mathf.Max(0f, amplitude));
            _noiseFrequency = Mathf.Max(1f, frequency);
        }

        public void Tick(float dt, float comfortScale = 1f)
        {
            dt = Mathf.Max(0f, dt);
            comfortScale = Mathf.Clamp01(comfortScale);

            // Critically-damped-feeling spring: impulses add velocity; state returns to zero.
            _positionVelocity += -_position * (115f * dt);
            _rotationVelocity += -_rotation * (92f * dt);
            _positionVelocity *= Mathf.Exp(-18f * dt);
            _rotationVelocity *= Mathf.Exp(-15f * dt);
            _position += _positionVelocity * dt;
            _rotation += _rotationVelocity * dt;

            _noisePhase += dt * _noiseFrequency;
            if (_noiseAmplitude > 0.0001f)
            {
                var noise = new Vector3(
                    Mathf.Sin(_noisePhase * 1.13f),
                    Mathf.Sin(_noisePhase * 1.71f + 1.2f),
                    Mathf.Sin(_noisePhase * 0.83f + 2.4f));
                _rotation += noise * (_noiseAmplitude * comfortScale * dt * 22f);
                _noiseAmplitude = Mathf.Max(0f, _noiseAmplitude - dt * 2.8f);
            }

            _position *= comfortScale;
            _rotation *= comfortScale;
        }

        public void Reset()
        {
            _position = Vector3.zero;
            _rotation = Vector3.zero;
            _positionVelocity = Vector3.zero;
            _rotationVelocity = Vector3.zero;
            _noiseAmplitude = 0f;
        }
    }
}
