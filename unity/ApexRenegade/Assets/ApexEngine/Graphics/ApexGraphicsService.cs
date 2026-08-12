using System.Collections;
using Apex.Core;
using Apex.Debugging;
using Apex.Settings;
using UnityEngine;

namespace Apex.Graphics
{
    [DefaultExecutionOrder(-800)]
    public sealed class ApexGraphicsService : MonoBehaviour, IApexService, IApexAdaptiveBudgetConsumer
    {
        private ApexSettingsService _settings;
        private bool _registered;
        private ApexPerformanceState _performanceState = ApexPerformanceState.Nominal;

        public int EffectiveTargetFrameRate { get; private set; } = 60;
        public float EffectiveShadowDistance { get; private set; } = 140f;
        public float EffectiveLodBias { get; private set; } = 1.35f;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureService()
        {
            if (Object.FindFirstObjectByType<ApexGraphicsService>() != null) return;
            new GameObject("Apex Graphics Service").AddComponent<ApexGraphicsService>();
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
            if (_settings == null) _settings = services.Get<ApexSettingsService>();
            _settings.Changed += OnSettingsChanged;
            services.Register(this);
            _registered = true;
            Apply(_settings.Data);
        }

        private void OnSettingsChanged(ApexSettingsData data) => Apply(data);

        public void Apply(ApexSettingsData data)
        {
            if (data == null) return;
            data.Sanitize();
            EffectiveTargetFrameRate = data.targetFrameRate;
            Application.targetFrameRate = EffectiveTargetFrameRate;
            QualitySettings.vSyncCount = data.vSync ? 1 : 0;

            if (!Application.isBatchMode)
            {
                var targetMode = data.fullscreen ? FullScreenMode.FullScreenWindow : FullScreenMode.Windowed;
                if (Screen.fullScreenMode != targetMode) Screen.fullScreenMode = targetMode;
            }

            var qualityScale = data.qualityPreset switch
            {
                0 => 0.55f,
                1 => 0.76f,
                2 => 1f,
                _ => 1.22f
            };
            var performanceScale = _performanceState switch
            {
                ApexPerformanceState.Critical => 0.55f,
                ApexPerformanceState.Constrained => 0.78f,
                _ => 1f
            };

            EffectiveShadowDistance = data.shadowDistance * qualityScale * performanceScale;
            EffectiveLodBias = data.lodBias * Mathf.Lerp(0.72f, 1f, performanceScale);
            QualitySettings.shadowDistance = EffectiveShadowDistance;
            QualitySettings.lodBias = EffectiveLodBias;
            QualitySettings.antiAliasing = _performanceState == ApexPerformanceState.Critical ? 0 : data.antiAliasing;
            QualitySettings.anisotropicFiltering = data.qualityPreset <= 0 ? AnisotropicFiltering.Disable : AnisotropicFiltering.Enable;
            QualitySettings.realtimeReflectionProbes = data.qualityPreset >= 2 && _performanceState == ApexPerformanceState.Nominal;
        }

        public void OnPerformanceStateChanged(ApexPerformanceState state)
        {
            if (_performanceState == state) return;
            _performanceState = state;
            Apply(_settings?.Data);
        }

        public void Shutdown()
        {
            if (_settings != null) _settings.Changed -= OnSettingsChanged;
            _registered = false;
        }
    }
}
