using System;
using System.Collections;
using Apex.Core;
using Apex.Settings;
using UnityEngine;

namespace Apex.Debugging
{
    public enum ApexPerformanceState { Nominal, Constrained, Critical }

    public interface IApexAdaptiveBudgetConsumer
    {
        void OnPerformanceStateChanged(ApexPerformanceState state);
    }

    [DefaultExecutionOrder(-810)]
    public sealed class ApexPerformanceBudget : MonoBehaviour, IApexService
    {
        private int _targetFps = 60;
        private float _smoothedMs = 16.67f;
        private float _badSeconds;
        private float _goodSeconds;
        private bool _registered;
        private ApexSettingsService _settings;

        public ApexPerformanceState State { get; private set; } = ApexPerformanceState.Nominal;
        public float SmoothedFrameMs => _smoothedMs;
        public int TargetFps => _targetFps;
        public float TargetFrameMs => 1000f / Mathf.Max(1, _targetFps);
        public event Action<ApexPerformanceState> StateChanged;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureService()
        {
            if (UnityEngine.Object.FindFirstObjectByType<ApexPerformanceBudget>() != null) return;
            new GameObject("Apex Performance Budget").AddComponent<ApexPerformanceBudget>();
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
            if (_settings == null) services.TryGet<ApexSettingsService>(out _settings);
            if (_settings != null)
            {
                _targetFps = Mathf.Max(30, _settings.Data.targetFrameRate);
                _smoothedMs = 1000f / _targetFps;
                _settings.Changed += OnSettingsChanged;
            }
            services.Register(this);
            _registered = true;
        }

        private void OnSettingsChanged(ApexSettingsData settings)
        {
            _targetFps = Mathf.Max(30, settings.targetFrameRate);
            _badSeconds = 0f;
            _goodSeconds = 0f;
            if (State != ApexPerformanceState.Nominal)
            {
                State = ApexPerformanceState.Nominal;
                StateChanged?.Invoke(State);
                Broadcast(State);
            }
        }

        private void Update()
        {
            var dt = Mathf.Clamp(Time.unscaledDeltaTime, 0.0001f, 0.25f);
            var sampleMs = dt * 1000f;
            _smoothedMs = Mathf.Lerp(_smoothedMs, sampleMs, 1f - Mathf.Exp(-2.5f * dt));
            var ratio = _smoothedMs / Mathf.Max(1f, TargetFrameMs);

            if (ratio > 1.42f)
            {
                _badSeconds += dt * 1.6f;
                _goodSeconds = 0f;
            }
            else if (ratio > 1.16f)
            {
                _badSeconds += dt;
                _goodSeconds = 0f;
            }
            else if (ratio < 1.04f)
            {
                _goodSeconds += dt;
                _badSeconds = Mathf.Max(0f, _badSeconds - dt * 0.55f);
            }

            var desired = State;
            if (_badSeconds > 3.5f) desired = ApexPerformanceState.Critical;
            else if (_badSeconds > 1.2f) desired = ApexPerformanceState.Constrained;
            else if (_goodSeconds > 4.5f) desired = ApexPerformanceState.Nominal;

            if (desired != State)
            {
                State = desired;
                if (State == ApexPerformanceState.Nominal) _badSeconds = 0f;
                StateChanged?.Invoke(State);
                Broadcast(State);
            }
        }

        private static void Broadcast(ApexPerformanceState state)
        {
            var behaviours = UnityEngine.Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Include, FindObjectsSortMode.None);
            for (var i = 0; i < behaviours.Length; i++)
                if (behaviours[i] is IApexAdaptiveBudgetConsumer consumer)
                    consumer.OnPerformanceStateChanged(state);
        }

        public void Shutdown()
        {
            if (_settings != null) _settings.Changed -= OnSettingsChanged;
            _registered = false;
        }
    }
}
