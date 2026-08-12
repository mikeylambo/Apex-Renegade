using System;
using Apex.Combat;
using Apex.Encounter;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeEscalationDirector : MonoBehaviour
    {
        private HealthComponent _health;
        private RenegadeArsenalController _arsenal;
        private float _lastHostileActivity = -10f;
        private Color _baseFog;
        private float _baseFogDensity;
        private Color _baseAmbient;

        public ApexEscalationMeter Pressure { get; private set; }
        public ApexEscalationMeter Refusal { get; private set; }
        public string PressureLabel => Pressure?.Stage.Id ?? "UNNOTICED";
        public string RefusalLabel => Refusal?.Stage.Id ?? "T0 // BASELINE";
        public event Action StateChanged;

        public void Configure(HealthComponent health, RenegadeArsenalController arsenal)
        {
            _health = health;
            _arsenal = arsenal;
            Pressure = new ApexEscalationMeter(
                new EscalationStage(0, "UNNOTICED", 0f),
                new EscalationStage(1, "RESPONSE", 0.18f),
                new EscalationStage(2, "MOBILIZATION", 0.40f),
                new EscalationStage(3, "REGIONAL SIEGE", 0.66f),
                new EscalationStage(4, "TOTAL CONTAINMENT", 0.88f));
            Refusal = new ApexEscalationMeter(
                new EscalationStage(0, "T0 // BASELINE", 0f),
                new EscalationStage(1, "T1 // AWAKENED", 0.25f),
                new EscalationStage(2, "T2 // OVERDRIVE", 0.55f),
                new EscalationStage(3, "T3 // APEX", 0.84f));

            _baseFog = RenderSettings.fogColor;
            _baseFogDensity = RenderSettings.fogDensity;
            _baseAmbient = RenderSettings.ambientLight;

            if (_health != null)
            {
                _health.Damaged += OnDamaged;
                _health.Died += OnDied;
            }
            if (_arsenal != null)
            {
                _arsenal.HitConfirmed += OnHitConfirmed;
                _arsenal.ShotFired += OnShotFired;
            }
            Pressure.StageChanged += _ => StateChanged?.Invoke();
            Refusal.StageChanged += _ => StateChanged?.Invoke();
        }

        private void OnShotFired(ApexWeaponRuntime weapon)
        {
            _lastHostileActivity = Time.unscaledTime;
            Pressure?.Add(weapon?.Definition.weaponId == "maw" ? 0.009f : 0.004f);
        }

        private void OnHitConfirmed(Vector3 point, bool killed)
        {
            _lastHostileActivity = Time.unscaledTime;
            Pressure?.Add(killed ? 0.055f : 0.012f);
            Refusal?.Add(killed ? 0.018f : 0.002f);
        }

        private void OnDamaged(DamagePayload payload, float health, float shield)
        {
            _lastHostileActivity = Time.unscaledTime;
            Pressure?.Add(0.025f);
            if (_health == null) return;
            var health01 = _health.MaxHealth > 0f ? health / _health.MaxHealth : 1f;
            var danger = 1f - Mathf.Clamp01(health01);
            Refusal?.Add(Mathf.Lerp(0.008f, 0.045f, danger));
        }

        private void OnDied()
        {
            Pressure?.Set(Mathf.Max(0.12f, Pressure.Value * 0.45f));
        }

        private void Update()
        {
            if (Pressure == null || Refusal == null) return;
            if (Time.unscaledTime - _lastHostileActivity > 4f)
                Pressure.Decay(Time.unscaledDeltaTime * 0.018f);
            if (Time.unscaledTime - _lastHostileActivity > 20f)
                Refusal.Decay(Time.unscaledDeltaTime * 0.0015f);

            var p = Pressure.Value;
            var r = Refusal.Value;
            var pressureFog = new Color(0.10f, 0.055f, 0.035f);
            var refusalFog = new Color(0.06f, 0.035f, 0.13f);
            RenderSettings.fogColor = Color.Lerp(Color.Lerp(_baseFog, pressureFog, p * 0.48f), refusalFog, r * 0.38f);
            RenderSettings.fogDensity = _baseFogDensity * Mathf.Lerp(1f, 1.38f, p) * Mathf.Lerp(1f, 0.88f, r);
            RenderSettings.ambientLight = Color.Lerp(Color.Lerp(_baseAmbient, new Color(0.24f, 0.14f, 0.08f), p * 0.32f), new Color(0.13f, 0.09f, 0.25f), r * 0.42f);
        }

        private void OnDestroy()
        {
            if (_health != null)
            {
                _health.Damaged -= OnDamaged;
                _health.Died -= OnDied;
            }
            if (_arsenal != null)
            {
                _arsenal.HitConfirmed -= OnHitConfirmed;
                _arsenal.ShotFired -= OnShotFired;
            }
        }
    }
}
