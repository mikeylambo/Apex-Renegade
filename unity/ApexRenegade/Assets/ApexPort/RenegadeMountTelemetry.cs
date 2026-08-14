using System.Collections;
using Apex.Core;
using Apex.Input;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-510)]
    public sealed class RenegadeMountTelemetry : MonoBehaviour
    {
        private ApexInputService _input;
        private ApexBikeMotor _bike;
        private ApexFirstPersonMotor _player;
        private double _mountPressedAt = -1;
        private double _recallStartedAt = -1;

        public double LastMountLatencyMs { get; private set; } = -1;
        public double LastRecallLatencyMs { get; private set; } = -1;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureTelemetry()
        {
            if (Object.FindFirstObjectByType<RenegadeMountTelemetry>() != null) return;
            new GameObject("Apex Mount Telemetry").AddComponent<RenegadeMountTelemetry>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                _player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                if (_bike != null && _player != null && ApexRuntime.IsInitialized && ApexRuntime.Services.TryGet<ApexInputService>(out _input))
                {
                    _bike.Mounted += OnMounted;
                    _bike.RecallStarted += OnRecallStarted;
                    _bike.RecallArrived += OnRecallArrived;
                    yield break;
                }
                yield return null;
            }
        }

        private void Update()
        {
            if (_input == null || _bike == null || _player == null || Time.timeScale <= 0f) return;
            if (_input.Pressed(_input.Bike) && !_bike.IsMounted && _bike.CanMount(_player.transform))
                _mountPressedAt = Time.realtimeSinceStartupAsDouble;
        }

        private void OnMounted()
        {
            if (_mountPressedAt < 0) return;
            LastMountLatencyMs = (Time.realtimeSinceStartupAsDouble - _mountPressedAt) * 1000.0;
            _mountPressedAt = -1;
            Debug.Log($"[Apex Bike Telemetry] Mount latency {LastMountLatencyMs:0.00} ms");
        }

        private void OnRecallStarted() => _recallStartedAt = Time.realtimeSinceStartupAsDouble;

        private void OnRecallArrived()
        {
            if (_recallStartedAt < 0) return;
            LastRecallLatencyMs = (Time.realtimeSinceStartupAsDouble - _recallStartedAt) * 1000.0;
            _recallStartedAt = -1;
            Debug.Log($"[Apex Bike Telemetry] Recall travel {LastRecallLatencyMs:0.0} ms");
        }

        private void OnDestroy()
        {
            if (_bike == null) return;
            _bike.Mounted -= OnMounted;
            _bike.RecallStarted -= OnRecallStarted;
            _bike.RecallArrived -= OnRecallArrived;
        }
    }
}
