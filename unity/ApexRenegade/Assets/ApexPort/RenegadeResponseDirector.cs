using System.Collections;
using Apex.Encounter;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-650)]
    public sealed class RenegadeResponseDirector : MonoBehaviour
    {
        private RenegadeEscalationDirector _escalation;
        private RenegadeEncounterSpawner _spawner;
        private Transform _observer;
        private int _highestStageResponded;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureResponseDirector()
        {
            if (Object.FindFirstObjectByType<RenegadeResponseDirector>() != null) return;
            new GameObject("Apex Response Director").AddComponent<RenegadeResponseDirector>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 60; i++)
            {
                var escalation = Object.FindFirstObjectByType<RenegadeEscalationDirector>();
                var spawner = Object.FindFirstObjectByType<RenegadeEncounterSpawner>();
                var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                if (escalation != null && spawner != null && player != null)
                {
                    Configure(escalation, spawner, player.transform);
                    yield break;
                }
                yield return null;
            }
            Debug.LogWarning("[Apex Response] Could not resolve escalation/spawner/player during bootstrap window.");
        }

        public void Configure(RenegadeEscalationDirector escalation, RenegadeEncounterSpawner spawner, Transform observer)
        {
            if (_escalation?.Pressure != null) _escalation.Pressure.StageChanged -= OnPressureStageChanged;
            _escalation = escalation;
            _spawner = spawner;
            _observer = observer;
            _highestStageResponded = escalation?.Pressure?.StageIndex ?? 0;
            if (_escalation?.Pressure != null) _escalation.Pressure.StageChanged += OnPressureStageChanged;
        }

        private void OnPressureStageChanged(EscalationStage stage)
        {
            if (_spawner == null || _observer == null || stage.Index <= _highestStageResponded) return;
            _highestStageResponded = stage.Index;

            // Rising Pressure creates concrete response. Counts stay intentionally conservative
            // until the lightweight/army simulation tier is ported.
            var hollowCount = stage.Index switch
            {
                1 => 2,
                2 => 3,
                3 => 4,
                _ => 5
            };
            var enforcerCount = Mathf.Max(0, stage.Index - 1);
            var origin = _observer.position + _observer.forward * 34f;

            for (var i = 0; i < hollowCount; i++)
                _spawner.Spawn("hollow", origin + new Vector3((i - hollowCount * 0.5f) * 4f, 0f, -8f - i * 2f));
            for (var i = 0; i < enforcerCount; i++)
                _spawner.Spawn("enforcer", origin + new Vector3((i - enforcerCount * 0.5f) * 7f, 0f, -18f - i * 4f));
        }

        private void OnDestroy()
        {
            if (_escalation?.Pressure != null) _escalation.Pressure.StageChanged -= OnPressureStageChanged;
        }
    }
}
