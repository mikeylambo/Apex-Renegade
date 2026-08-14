using Apex.Audio;
using Apex.Combat;
using Apex.Interaction;
using UnityEngine;

namespace Apex.Renegade
{
    public enum RenegadePickupKind { Ammo, Health, Shield }

    public sealed class RenegadePickup : MonoBehaviour, IApexInteractable
    {
        private RenegadePickupKind _kind;
        private string _weaponId;
        private int _amount;
        private RenegadeArsenalController _arsenal;
        private HealthComponent _health;
        private ApexAudioService _audio;
        private Vector3 _basePosition;
        private float _phase;
        private bool _consumed;

        public void Configure(RenegadePickupKind kind, int amount, RenegadeArsenalController arsenal, HealthComponent health, ApexAudioService audio, string weaponId = null)
        {
            _kind = kind;
            _amount = Mathf.Max(1, amount);
            _weaponId = weaponId;
            _arsenal = arsenal;
            _health = health;
            _audio = audio;
            _basePosition = transform.position;
            _phase = UnityEngine.Random.value * Mathf.PI * 2f;
        }

        public bool CanInteract(GameObject actor)
        {
            if (_consumed || actor == null || _health == null || !_health.IsAlive) return false;
            return _kind switch
            {
                RenegadePickupKind.Ammo => _arsenal != null && _arsenal.Loadout?.Find(_weaponId) != null,
                RenegadePickupKind.Health => _health.Health < _health.MaxHealth - 0.01f,
                RenegadePickupKind.Shield => _health.MaxShield > 0f && _health.Shield < _health.MaxShield - 0.01f,
                _ => false
            };
        }

        public InteractionPrompt GetPrompt(GameObject actor)
        {
            var label = _kind switch
            {
                RenegadePickupKind.Ammo => $"TAKE {WeaponLabel(_weaponId)} AMMO +{_amount}",
                RenegadePickupKind.Health => $"RESTORE VITALITY +{_amount}",
                RenegadePickupKind.Shield => $"RESTORE SHIELD +{_amount}",
                _ => "TAKE"
            };
            return new InteractionPrompt("Interact", label);
        }

        public void Interact(GameObject actor)
        {
            if (!CanInteract(actor)) return;
            var applied = _kind switch
            {
                RenegadePickupKind.Ammo => _arsenal.AddAmmo(_weaponId, _amount),
                RenegadePickupKind.Health => Mathf.RoundToInt(_health.RestoreHealth(_amount)),
                RenegadePickupKind.Shield => Mathf.RoundToInt(_health.RestoreShield(_amount)),
                _ => 0
            };
            if (applied <= 0) return;
            _consumed = true;
            _audio?.Play("pickup", 0.72f);
            gameObject.SetActive(false);
        }

        private void Update()
        {
            if (_consumed) return;
            var t = Time.unscaledTime + _phase;
            transform.position = _basePosition + Vector3.up * (Mathf.Sin(t * 2.1f) * 0.12f);
            transform.Rotate(Vector3.up, 42f * Time.unscaledDeltaTime, Space.World);
        }

        private static string WeaponLabel(string id)
        {
            if (string.Equals(id, "maw", System.StringComparison.OrdinalIgnoreCase)) return "MAW";
            if (string.Equals(id, "corona-blaster", System.StringComparison.OrdinalIgnoreCase)) return "CORONA";
            return "WEAPON";
        }
    }
}
