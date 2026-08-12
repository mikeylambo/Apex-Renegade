using System;
using UnityEngine;

namespace Apex.Combat
{
    [CreateAssetMenu(menuName = "Apex/Combat/Weapon Definition", fileName = "WeaponDefinition")]
    public sealed class WeaponDefinition : ScriptableObject
    {
        [Header("Identity")]
        public string weaponId = "weapon";
        public string displayName = "Weapon";

        [Header("Ammo")]
        [Min(1)] public int magazineSize = 12;
        [Min(0)] public int startingReserve = 72;
        [Min(0.01f)] public float reloadDuration = 1.25f;

        [Header("Fire")]
        [Min(0.01f)] public float roundsPerSecond = 7.5f;
        public bool automatic = true;
        [Min(1)] public int pellets = 1;
        [Min(0f)] public float spreadDegrees = 0.35f;
        [Min(0.1f)] public float range = 180f;
        [Min(0f)] public float damage = 20f;
        public DamageKind damageKind = DamageKind.Energy;

        [Header("Presentation")]
        [Range(35f, 100f)] public float adsFov = 72f;
        [Min(0f)] public float recoilPitch = 1.2f;
        [Min(0f)] public float recoilYaw = 0.35f;
        [Min(0f)] public float hitImpulse = 3f;

        public void Sanitize()
        {
            weaponId = string.IsNullOrWhiteSpace(weaponId) ? "weapon" : weaponId.Trim();
            displayName = string.IsNullOrWhiteSpace(displayName) ? weaponId : displayName.Trim();
            magazineSize = Mathf.Max(1, magazineSize);
            startingReserve = Mathf.Max(0, startingReserve);
            reloadDuration = Mathf.Max(0.01f, reloadDuration);
            roundsPerSecond = Mathf.Max(0.01f, roundsPerSecond);
            pellets = Mathf.Max(1, pellets);
            spreadDegrees = Mathf.Max(0f, spreadDegrees);
            range = Mathf.Max(0.1f, range);
            damage = Mathf.Max(0f, damage);
            adsFov = Mathf.Clamp(adsFov, 35f, 100f);
            recoilPitch = Mathf.Max(0f, recoilPitch);
            recoilYaw = Mathf.Max(0f, recoilYaw);
            hitImpulse = Mathf.Max(0f, hitImpulse);
        }
    }

    public readonly struct WeaponShot
    {
        public readonly int Sequence;
        public readonly int MagazineRemaining;
        public readonly int ReserveRemaining;

        public WeaponShot(int sequence, int magazineRemaining, int reserveRemaining)
        {
            Sequence = sequence;
            MagazineRemaining = magazineRemaining;
            ReserveRemaining = reserveRemaining;
        }
    }

    public sealed class ApexWeaponRuntime
    {
        public WeaponDefinition Definition { get; }
        public WeaponStateMachine StateMachine { get; }
        public int ShotSequence { get; private set; }
        public WeaponState State => StateMachine.State;
        public int Magazine => StateMachine.Magazine;
        public int Reserve => StateMachine.Reserve;
        public float TimeInState => StateMachine.TimeInState;

        public event Action<WeaponState> StateChanged;
        public event Action<WeaponShot> Fired;
        public event Action ReloadStarted;
        public event Action ReloadCompleted;
        public event Action DryFired;

        private WeaponState _lastState;

        public ApexWeaponRuntime(WeaponDefinition definition)
        {
            Definition = definition != null ? definition : throw new ArgumentNullException(nameof(definition));
            Definition.Sanitize();
            StateMachine = new WeaponStateMachine(
                Definition.magazineSize,
                Definition.startingReserve,
                Definition.roundsPerSecond,
                Definition.reloadDuration);
            _lastState = StateMachine.State;
        }

        public void Equip()
        {
            StateMachine.Equip();
            PublishStateIfChanged();
        }

        public void Holster()
        {
            StateMachine.Holster();
            PublishStateIfChanged();
        }

        public void Tick(float dt)
        {
            var before = StateMachine.State;
            StateMachine.Tick(dt);
            PublishStateIfChanged();
            if (before == WeaponState.Reloading && StateMachine.State != WeaponState.Reloading)
                ReloadCompleted?.Invoke();
        }

        public bool TryFire()
        {
            if (!StateMachine.TryFire())
            {
                if (StateMachine.State == WeaponState.Empty || StateMachine.Magazine <= 0)
                    DryFired?.Invoke();
                return false;
            }

            ShotSequence++;
            Fired?.Invoke(new WeaponShot(ShotSequence, Magazine, Reserve));
            PublishStateIfChanged();
            return true;
        }

        public bool TryReload()
        {
            if (!StateMachine.TryReload()) return false;
            ReloadStarted?.Invoke();
            PublishStateIfChanged();
            return true;
        }

        public void AddReserve(int amount) => StateMachine.AddReserve(amount);

        private void PublishStateIfChanged()
        {
            if (_lastState == StateMachine.State) return;
            _lastState = StateMachine.State;
            StateChanged?.Invoke(_lastState);
        }
    }
}
