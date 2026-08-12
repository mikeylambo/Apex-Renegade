using Apex.Encounter;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeResponseDirector : MonoBehaviour
    {
        private RenegadeEscalationDirector _escalation;
        private RenegadeEncounterSpawner _spawner;
        private Transform _observer;
        private int _highestStageResponded;

        public void Configure(RenegadeEscalationDirector escalation, RenegadeEncounterSpawner spawner, Transform observer)
        {
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
