using System;
using UnityEngine;

namespace Apex.Abilities
{
    [Serializable]
    public sealed class ApexChargeMeter
    {
        [SerializeField, Range(0f, 1f)] private float value;
        public float Value => value;
        public bool Full => value >= 0.999f;
        public event Action<float> Changed;
        public event Action Filled;

        public void Set(float next)
        {
            var beforeFull = Full;
            var clamped = Mathf.Clamp01(next);
            if (Mathf.Approximately(value, clamped)) return;
            value = clamped;
            Changed?.Invoke(value);
            if (!beforeFull && Full) Filled?.Invoke();
        }

        public void Add(float amount) => Set(value + Mathf.Max(0f, amount));

        public bool TryConsume(float amount = 1f)
        {
            amount = Mathf.Clamp01(amount);
            if (value + 0.0001f < amount) return false;
            Set(value - amount);
            return true;
        }
    }

    public sealed class ApexAbilityRuntime
    {
        public string Id { get; }
        public float Cooldown { get; }
        public float ActiveDuration { get; }
        public float CooldownRemaining { get; private set; }
        public float ActiveRemaining { get; private set; }
        public bool Active => ActiveRemaining > 0f;
        public bool Ready => CooldownRemaining <= 0f && !Active;

        public event Action Activated;
        public event Action Ended;
        public event Action ReadyChanged;

        private bool _lastReady;

        public ApexAbilityRuntime(string id, float cooldown, float activeDuration = 0f)
        {
            Id = string.IsNullOrWhiteSpace(id) ? "ability" : id.Trim();
            Cooldown = Mathf.Max(0f, cooldown);
            ActiveDuration = Mathf.Max(0f, activeDuration);
            _lastReady = Ready;
        }

        public bool TryActivate()
        {
            if (!Ready) return false;
            ActiveRemaining = ActiveDuration;
            CooldownRemaining = Cooldown;
            Activated?.Invoke();
            PublishReady();
            if (ActiveDuration <= 0f) Ended?.Invoke();
            return true;
        }

        public void Tick(float dt)
        {
            dt = Mathf.Max(0f, dt);
            var wasActive = Active;
            CooldownRemaining = Mathf.Max(0f, CooldownRemaining - dt);
            ActiveRemaining = Mathf.Max(0f, ActiveRemaining - dt);
            if (wasActive && !Active) Ended?.Invoke();
            PublishReady();
        }

        public void Reset()
        {
            CooldownRemaining = 0f;
            ActiveRemaining = 0f;
            PublishReady();
        }

        private void PublishReady()
        {
            if (_lastReady == Ready) return;
            _lastReady = Ready;
            ReadyChanged?.Invoke();
        }
    }
}
