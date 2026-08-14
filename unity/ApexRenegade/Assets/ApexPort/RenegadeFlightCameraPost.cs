using System.Collections;
using Apex.Settings;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(650)]
    public sealed class RenegadeFlightCameraPost : MonoBehaviour
    {
        private ApexFlightController _flight;
        private Camera _camera;
        private ApexSettingsService _settings;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsurePost()
        {
            if (Object.FindFirstObjectByType<RenegadeFlightCameraPost>() != null) return;
            new GameObject("Apex Flight Camera Post").AddComponent<RenegadeFlightCameraPost>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _flight = Object.FindFirstObjectByType<ApexFlightController>();
                _camera = Object.FindFirstObjectByType<Camera>();
                if (_flight != null && _camera != null && Apex.Core.ApexRuntime.IsInitialized && Apex.Core.ApexRuntime.Services.TryGet<ApexSettingsService>(out _settings))
                    yield break;
                yield return null;
            }
        }

        private void LateUpdate()
        {
            if (Time.timeScale <= 0f || _flight == null || !_flight.IsFlying || _camera == null) return;
            var speed01 = Mathf.Clamp01(_flight.Velocity.magnitude / 34f);
            var target = (_settings?.Data.fov ?? 92f) + speed01 * 12f;
            _camera.fieldOfView = Mathf.Lerp(_camera.fieldOfView, target, 1f - Mathf.Exp(-6.5f * Time.unscaledDeltaTime));
        }
    }
}
