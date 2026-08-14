using System;
using System.Collections.Generic;

namespace Apex.Combat
{
    public sealed class ApexWeaponLoadout
    {
        private readonly List<ApexWeaponRuntime> _weapons = new();
        public IReadOnlyList<ApexWeaponRuntime> Weapons => _weapons;
        public int ActiveIndex { get; private set; } = -1;
        public ApexWeaponRuntime Active => ActiveIndex >= 0 && ActiveIndex < _weapons.Count ? _weapons[ActiveIndex] : null;

        public event Action<int, ApexWeaponRuntime> WeaponChanged;
        public event Action<ApexWeaponRuntime, int> AmmoAdded;

        public int Count => _weapons.Count;

        public void Add(ApexWeaponRuntime weapon, bool equipIfFirst = true)
        {
            if (weapon == null) throw new ArgumentNullException(nameof(weapon));
            if (_weapons.Contains(weapon)) return;
            weapon.Holster();
            _weapons.Add(weapon);
            if (equipIfFirst && ActiveIndex < 0) EquipIndex(0);
        }

        public bool EquipIndex(int index)
        {
            if (index < 0 || index >= _weapons.Count || index == ActiveIndex) return false;
            Active?.Holster();
            ActiveIndex = index;
            Active.Equip();
            WeaponChanged?.Invoke(ActiveIndex, Active);
            return true;
        }

        public bool EquipNext()
        {
            if (_weapons.Count <= 1) return false;
            return EquipIndex((ActiveIndex + 1 + _weapons.Count) % _weapons.Count);
        }

        public bool EquipPrevious()
        {
            if (_weapons.Count <= 1) return false;
            return EquipIndex((ActiveIndex - 1 + _weapons.Count) % _weapons.Count);
        }

        public ApexWeaponRuntime Find(string weaponId)
        {
            if (string.IsNullOrWhiteSpace(weaponId)) return null;
            for (var i = 0; i < _weapons.Count; i++)
                if (string.Equals(_weapons[i].Definition.weaponId, weaponId, StringComparison.OrdinalIgnoreCase))
                    return _weapons[i];
            return null;
        }

        public int AddAmmo(string weaponId, int amount)
        {
            if (amount <= 0) return 0;
            var weapon = Find(weaponId);
            if (weapon == null) return 0;
            weapon.AddReserve(amount);
            AmmoAdded?.Invoke(weapon, amount);
            return amount;
        }

        public void Tick(float dt)
        {
            for (var i = 0; i < _weapons.Count; i++)
                _weapons[i].Tick(dt);
        }
    }
}
