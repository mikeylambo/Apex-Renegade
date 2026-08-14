using System.Collections.Generic;
using UnityEngine;

namespace Apex.Combat
{
    public interface IAimAssistTarget
    {
        bool AimAssistEligible { get; }
        Vector3 AimAssistPoint { get; }
        float AimAssistPriority { get; }
    }

    public readonly struct AimAssistSolution
    {
        public readonly IAimAssistTarget Target;
        public readonly Vector3 Direction;
        public readonly float Strength;
        public readonly float AngularError;

        public AimAssistSolution(IAimAssistTarget target, Vector3 direction, float strength, float angularError)
        {
            Target = target;
            Direction = direction;
            Strength = Mathf.Clamp01(strength);
            AngularError = angularError;
        }
    }

    public sealed class ApexAimAssistResolver
    {
        private readonly List<IAimAssistTarget> _targets = new();
        public float MaxAngle { get; set; } = 9f;
        public float MaxDistance { get; set; } = 55f;
        public float FrictionInnerAngle { get; set; } = 3.5f;

        public void Register(IAimAssistTarget target)
        {
            if (target != null && !_targets.Contains(target)) _targets.Add(target);
        }

        public void Unregister(IAimAssistTarget target) => _targets.Remove(target);

        public bool TryResolve(Vector3 origin, Vector3 forward, out AimAssistSolution solution)
        {
            IAimAssistTarget best = null;
            var bestScore = float.NegativeInfinity;
            var bestDirection = forward;
            var bestAngle = 0f;

            for (var i = _targets.Count - 1; i >= 0; i--)
            {
                var target = _targets[i];
                if (target == null)
                {
                    _targets.RemoveAt(i);
                    continue;
                }
                if (!target.AimAssistEligible) continue;

                var to = target.AimAssistPoint - origin;
                var distance = to.magnitude;
                if (distance <= 0.001f || distance > MaxDistance) continue;
                var direction = to / distance;
                var angle = Vector3.Angle(forward, direction);
                if (angle > MaxAngle) continue;

                var angleScore = 1f - angle / Mathf.Max(0.001f, MaxAngle);
                var distanceScore = 1f - distance / Mathf.Max(0.001f, MaxDistance);
                var score = angleScore * 0.72f + distanceScore * 0.18f + target.AimAssistPriority * 0.10f;
                if (score <= bestScore) continue;
                bestScore = score;
                best = target;
                bestDirection = direction;
                bestAngle = angle;
            }

            if (best == null)
            {
                solution = default;
                return false;
            }

            var strength = 1f - Mathf.Clamp01(bestAngle / Mathf.Max(FrictionInnerAngle, MaxAngle));
            strength = Mathf.Max(strength, bestScore * 0.45f);
            solution = new AimAssistSolution(best, bestDirection, strength, bestAngle);
            return true;
        }
    }
}
