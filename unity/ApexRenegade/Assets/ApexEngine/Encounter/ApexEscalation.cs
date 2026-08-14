using System;
using UnityEngine;

namespace Apex.Encounter
{
    [Serializable]
    public readonly struct EscalationStage
    {
        public readonly int Index;
        public readonly string Id;
        public readonly float Threshold;

        public EscalationStage(int index, string id, float threshold)
        {
            Index = index;
            Id = id ?? string.Empty;
            Threshold = Mathf.Clamp01(threshold);
        }
    }

    public sealed class ApexEscalationMeter
    {
        private readonly EscalationStage[] _stages;
        public float Value { get; private set; }
        public int StageIndex { get; private set; }
        public EscalationStage Stage => _stages[Mathf.Clamp(StageIndex, 0, _stages.Length - 1)];
        public event Action<float> ValueChanged;
        public event Action<EscalationStage> StageChanged;

        public ApexEscalationMeter(params EscalationStage[] stages)
        {
            if (stages == null || stages.Length == 0)
                stages = new[] { new EscalationStage(0, "baseline", 0f) };
            _stages = stages;
            Array.Sort(_stages, (a, b) => a.Threshold.CompareTo(b.Threshold));
            StageIndex = ResolveStage(0f);
        }

        public void Set(float value)
        {
            value = Mathf.Clamp01(value);
            if (Mathf.Approximately(value, Value)) return;
            Value = value;
            ValueChanged?.Invoke(Value);
            var next = ResolveStage(Value);
            if (next == StageIndex) return;
            StageIndex = next;
            StageChanged?.Invoke(Stage);
        }

        public void Add(float amount) => Set(Value + amount);
        public void Decay(float amount) => Set(Value - Mathf.Max(0f, amount));

        private int ResolveStage(float value)
        {
            var resolved = 0;
            for (var i = 0; i < _stages.Length; i++)
                if (value >= _stages[i].Threshold) resolved = i;
            return resolved;
        }
    }
}
