using System;
using UnityEngine;

namespace Apex.Combat
{
    public enum DamageKind { Ballistic, Impact, Energy, Environmental }

    public readonly struct DamagePayload
    {
        public readonly float Amount;
        public readonly Vector3 Point;
        public readonly Vector3 Direction;
        public readonly DamageKind Kind;
        public readonly GameObject Source;

        public DamagePayload(float amount, Vector3 point, Vector3 direction, DamageKind kind, GameObject source = null)
        {
            Amount = Mathf.Max(0f, amount);
            Point = point;
            Direction = direction;
            Kind = kind;
            Source = source;
        }
    }

    public interface IDamageable
    {
        bool IsAlive { get; }
        void ApplyDamage(in DamagePayload payload);
    }

    public sealed class HealthComponent : MonoBehaviour, IDamageable
    {
        [SerializeField, Min(1f)] private float maxHealth = 100f;
        [SerializeField, Min(0f)] private float maxShield;
        public float Health { get; private set; }
        public float Shield { get; private set; }
        public float MaxHealth => maxHealth;
        public float MaxShield => maxShield;
        public bool IsAlive => Health > 0f;

        public event Action<DamagePayload, float, float> Damaged;
        public event Action<float, float> Restored;
        public event Action Died;

        private void Awake() => ResetVitals();

        public void Configure(float health, float shield = 0f)
        {
            maxHealth = Mathf.Max(1f, health);
            maxShield = Mathf.Max(0f, shield);
            ResetVitals();
        }

        public void ResetVitals()
        {
            Health = maxHealth;
            Shield = maxShield;
            Restored?.Invoke(Health, Shield);
        }

        public float RestoreHealth(float amount)
        {
            if (!IsAlive || amount <= 0f) return 0f;
            var before = Health;
            Health = Mathf.Min(maxHealth, Health + amount);
            var restored = Health - before;
            if (restored > 0f) Restored?.Invoke(Health, Shield);
            return restored;
        }

        public float RestoreShield(float amount)
        {
            if (!IsAlive || amount <= 0f || maxShield <= 0f) return 0f;
            var before = Shield;
            Shield = Mathf.Min(maxShield, Shield + amount);
            var restored = Shield - before;
            if (restored > 0f) Restored?.Invoke(Health, Shield);
            return restored;
        }

        public void ApplyDamage(in DamagePayload payload)
        {
            if (!IsAlive || payload.Amount <= 0f) return;
            var remaining = payload.Amount;
            if (Shield > 0f)
            {
                var absorbed = Mathf.Min(Shield, remaining);
                Shield -= absorbed;
                remaining -= absorbed;
            }
            if (remaining > 0f) Health = Mathf.Max(0f, Health - remaining);
            Damaged?.Invoke(payload, Health, Shield);
            if (!IsAlive) Died?.Invoke();
        }
    }

    public enum WeaponState { Holstered, Equipping, Ready, Firing, Reloading, Empty }

    public sealed class WeaponStateMachine
    {
        public WeaponState State { get; private set; } = WeaponState.Holstered;
        public int Magazine { get; private set; }
        public int Reserve { get; private set; }
        public int MagazineSize { get; }
        public float FireInterval { get; }
        public float ReloadDuration { get; }
        public float TimeInState { get; private set; }
        private float _cooldown;

        public WeaponStateMachine(int magazineSize, int reserve, float roundsPerSecond, float reloadDuration)
        {
            MagazineSize = Mathf.Max(1, magazineSize);
            Magazine = MagazineSize;
            Reserve = Mathf.Max(0, reserve);
            FireInterval = 1f / Mathf.Max(0.01f, roundsPerSecond);
            ReloadDuration = Mathf.Max(0.01f, reloadDuration);
        }

        public void Equip() => SetState(Magazine > 0 ? WeaponState.Ready : WeaponState.Empty);
        public void Holster() => SetState(WeaponState.Holstered);

        public void Tick(float dt)
        {
            dt = Mathf.Max(0f, dt);
            TimeInState += dt;
            _cooldown = Mathf.Max(0f, _cooldown - dt);
            if (State == WeaponState.Reloading && TimeInState >= ReloadDuration) FinishReload();
            else if (State == WeaponState.Firing && _cooldown <= 0f) SetState(Magazine > 0 ? WeaponState.Ready : WeaponState.Empty);
        }

        public bool TryFire()
        {
            if ((State != WeaponState.Ready && State != WeaponState.Firing) || _cooldown > 0f || Magazine <= 0) return false;
            Magazine--;
            _cooldown = FireInterval;
            SetState(WeaponState.Firing);
            if (Magazine <= 0) State = WeaponState.Empty;
            return true;
        }

        public bool TryReload()
        {
            if (State == WeaponState.Reloading || State == WeaponState.Holstered || Magazine >= MagazineSize || Reserve <= 0) return false;
            SetState(WeaponState.Reloading);
            return true;
        }

        public void AddReserve(int amount) => Reserve = Mathf.Max(0, Reserve + amount);

        private void FinishReload()
        {
            var needed = MagazineSize - Magazine;
            var loaded = Mathf.Min(needed, Reserve);
            Magazine += loaded;
            Reserve -= loaded;
            SetState(Magazine > 0 ? WeaponState.Ready : WeaponState.Empty);
        }

        private void SetState(WeaponState next)
        {
            if (State == next) return;
            State = next;
            TimeInState = 0f;
        }
    }
}
