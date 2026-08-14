using System.Collections;
using Apex.Core;
using Apex.Settings;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Apex.Input
{
    [DefaultExecutionOrder(-820)]
    public sealed class ApexHapticsService : MonoBehaviour, IApexService
    {
        private ApexSettingsService _settings;
        private float _low;
        private float _high;
        private float _until;
        private bool _registered;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureService()
        {
            if (Object.FindFirstObjectByType<ApexHapticsService>() != null) return;
            new GameObject("Apex Haptics Service").AddComponent<ApexHapticsService>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 120; i++)
            {
                if (ApexRuntime.IsInitialized && ApexRuntime.Services.TryGet<ApexSettingsService>(out _settings))
                {
                    Initialize(ApexRuntime.Services);
                    yield break;
                }
                yield return null;
            }
        }

        public void Initialize(ApexServices services)
        {
            if (_registered) return;
            if (_settings == null) services.TryGet(out _settings);
            services.Register(this);
            _registered = true;
        }

        public void Pulse(float lowFrequency, float highFrequency, float duration)
        {
            var strength = _settings?.Data.vibration ?? 1f;
            if (strength <= 0.001f || duration <= 0f) return;
            _low = Mathf.Max(_low, Mathf.Clamp01(lowFrequency) * strength);
            _high = Mathf.Max(_high, Mathf.Clamp01(highFrequency) * strength);
            _until = Mathf.Max(_until, Time.unscaledTime + duration);
            Apply();
        }

        private void Update()
        {
            if (Time.unscaledTime < _until)
            {
                Apply();
                return;
            }
            if (_low > 0f || _high > 0f)
            {
                _low = 0f;
                _high = 0f;
                Apply();
            }
        }

        private void Apply()
        {
            var gamepad = Gamepad.current;
            if (gamepad == null) return;
            gamepad.SetMotorSpeeds(_low, _high);
        }

        private void OnApplicationFocus(bool focus)
        {
            if (!focus) Stop();
        }

        public void Stop()
        {
            _low = 0f;
            _high = 0f;
            _until = 0f;
            Gamepad.current?.SetMotorSpeeds(0f, 0f);
        }

        public void Shutdown()
        {
            Stop();
            _registered = false;
        }

        private void OnDestroy() => Stop();
    }
}
