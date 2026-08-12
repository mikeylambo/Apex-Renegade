using Apex.Audio;
using Apex.Combat;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeAudioBridge : MonoBehaviour
    {
        private ApexAudioService _audio;
        private ApexBikeMotor _bike;
        private HealthComponent _health;
        private RenegadeArsenalController _arsenal;

        public void Configure(ApexAudioService audio, ApexBikeMotor bike, HealthComponent health, RenegadeArsenalController arsenal)
        {
            _audio = audio;
            _bike = bike;
            _health = health;
            _arsenal = arsenal;

            if (_bike != null)
            {
                _bike.Mounted += OnMounted;
                _bike.RecallStarted += OnRecall;
                _bike.BoostStarted += OnBoost;
            }
            if (_health != null) _health.Damaged += OnDamaged;
        }

        private void OnMounted() => _audio?.Play("bike.mount", 0.78f);
        private void OnRecall() => _audio?.Play("bike.recall", 0.82f);
        private void OnBoost() => _audio?.Play("bike.boost", 0.62f);
        private void OnDamaged(DamagePayload payload, float health, float shield) => _audio?.Play("player.damage", 0.55f);

        private void OnDestroy()
        {
            if (_bike != null)
            {
                _bike.Mounted -= OnMounted;
                _bike.RecallStarted -= OnRecall;
                _bike.BoostStarted -= OnBoost;
            }
            if (_health != null) _health.Damaged -= OnDamaged;
        }
    }
}
