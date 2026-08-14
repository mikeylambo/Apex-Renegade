using System.Collections;
using Apex.Audio;
using Apex.Core;
using Apex.Input;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-535)]
    public sealed class RenegadeFlightFeedback : MonoBehaviour
    {
        private ApexFlightController _flight;
        private ApexAudioService _audio;
        private ApexHapticsService _haptics;
        private ApexPortCameraV2 _camera;
        private Camera _unityCamera;
        private float _baseFov;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureFeedback()
        {
            if (Object.FindFirstObjectByType<RenegadeFlightFeedback>() != null) return;
            new GameObject("Apex Flight Feedback").AddComponent<RenegadeFlightFeedback>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _flight = Object.FindFirstObjectByType<ApexFlightController>();
                _camera = Object.FindFirstObjectByType<ApexPortCameraV2>();
                _unityCamera = Object.FindFirstObjectByType<Camera>();
                if (ApexRuntime.IsInitialized &&
                    ApexRuntime.Services.TryGet<ApexAudioService>(out _audio) &&
                    ApexRuntime.Services.TryGet<ApexHapticsService>(out _haptics) &&
                    _flight != null && _camera != null && _unityCamera != null)
                {
                    _baseFov = _unityCamera.fieldOfView;
                    _flight.FlightChanged += OnFlightChanged;
                    _flight.FlightBoostStarted += OnFlightBoost;
                    yield break;
                }
                yield return null;
            }
        }

        private void OnFlightChanged(bool active)
        {
            _audio?.Play(active ? "player.dash" : "ui.confirm", active ? 0.55f : 0.32f, ApexAudioBus.Sfx, active ? 0.72f : 0.82f);
            _haptics?.Pulse(active ? 0.26f : 0.10f, active ? 0.56f : 0.22f, active ? 0.12f : 0.07f);
            _camera?.Impulse.Kick(new Vector3(0f, active ? 0.02f : -0.01f, active ? -0.07f : 0f), new Vector3(active ? -1.8f : 1.1f, 0f, 0f));
        }

        private void OnFlightBoost()
        {
            _audio?.Play("bike.boost", 0.55f, ApexAudioBus.Sfx, 1.18f);
            _haptics?.Pulse(0.18f, 0.52f, 0.09f);
            _camera?.Impulse.Kick(new Vector3(0f, 0f, -0.055f), new Vector3(-0.8f, 0f, 0f));
        }

        private void LateUpdate()
        {
            if (_flight == null || _unityCamera == null || !_flight.IsFlying || Time.timeScale <= 0f) return;
            var speed01 = Mathf.Clamp01(_flight.Velocity.magnitude / 34f);
            var target = Mathf.Max(_baseFov, 92f) + speed01 * 12f;
            _unityCamera.fieldOfView = Mathf.Lerp(_unityCamera.fieldOfView, target, 1f - Mathf.Exp(-5f * Time.unscaledDeltaTime));
        }

        private void OnDestroy()
        {
            if (_flight == null) return;
            _flight.FlightChanged -= OnFlightChanged;
            _flight.FlightBoostStarted -= OnFlightBoost;
        }
    }
}
