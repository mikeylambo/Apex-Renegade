using System;
using UnityEngine;

namespace Apex.Encounter
{
    [Serializable]
    public readonly struct ApexPopulationBudget
    {
        public readonly int Active;
        public readonly int Lightweight;
        public readonly int Distant;
        public int Total => Active + Lightweight + Distant;

        public ApexPopulationBudget(int active, int lightweight, int distant)
        {
            Active = Mathf.Max(0, active);
            Lightweight = Mathf.Max(0, lightweight);
            Distant = Mathf.Max(0, distant);
        }

        public ApexPopulationBudget Scale(float scale)
        {
            scale = Mathf.Clamp01(scale);
            return new ApexPopulationBudget(
                Mathf.Max(Active > 0 ? 1 : 0, Mathf.RoundToInt(Active * Mathf.Lerp(0.55f, 1f, scale))),
                Mathf.RoundToInt(Lightweight * scale),
                Mathf.RoundToInt(Distant * scale));
        }
    }

    public sealed class ApexThreatPopulationModel
    {
        private readonly ApexPopulationBudget[] _stages;

        public ApexThreatPopulationModel(params ApexPopulationBudget[] stages)
        {
            _stages = stages is { Length: > 0 }
                ? stages
                : new[] { new ApexPopulationBudget(4, 16, 64) };
        }

        public ApexPopulationBudget ForStage(int stageIndex, float performanceScale = 1f)
        {
            var stage = _stages[Mathf.Clamp(stageIndex, 0, _stages.Length - 1)];
            return stage.Scale(performanceScale);
        }
    }
}
