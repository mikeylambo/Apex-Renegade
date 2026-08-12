using System;
using System.Collections;
using System.Collections.Generic;
using Apex.Combat;
using Apex.Core;
using Apex.Save;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [Serializable]
    public sealed class RenegadeWeaponSaveData
    {
        public string weaponId = string.Empty;
        public int magazine;
        public int reserve;
    }

    [Serializable]
    public sealed class RenegadeSavePayload
    {
        public int version = 1;
        public string activeWeaponId = "corona-blaster";
        public float pressure;
        public float refusal;
        public List<RenegadeWeaponSaveData> weapons = new();
    }

    [DefaultExecutionOrder(-620)]
    public sealed class RenegadeSaveBridge : MonoBehaviour
    {
        private ApexSaveService _save;
        private ApexFirstPersonMotor _player;
        private RenegadeArsenalController _arsenal;
        private RenegadeEscalationDirector _escalation;
        private float _nextPeriodicSave;
        private bool _ready;
        private bool _restoring;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureBridge()
        {
            if (Object.FindFirstObjectByType<RenegadeSaveBridge>() != null) return;
            new GameObject("Apex Renegade Save Bridge").AddComponent<RenegadeSaveBridge>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                _arsenal = Object.FindFirstObjectByType<RenegadeArsenalController>();
                _escalation = Object.FindFirstObjectByType<RenegadeEscalationDirector>();
                if (ApexRuntime.IsInitialized &&
                    ApexRuntime.Services.TryGet<ApexSaveService>(out _save) &&
                    _player != null && _arsenal?.Loadout != null && _escalation?.Pressure != null)
                {
                    InstallPlayerMarker();
                    RestorePayload();
                    Subscribe();
                    _ready = true;
                    _nextPeriodicSave = Time.unscaledTime + 8f;
                    yield break;
                }
                yield return null;
            }
            Debug.LogWarning("[Apex Save] Renegade save bridge could not resolve runtime dependencies.");
        }

        private void InstallPlayerMarker()
        {
            if (_player.GetComponent<ApexFirstPersonMarker>() == null)
                _player.gameObject.AddComponent<ApexFirstPersonMarker>();
        }

        private void RestorePayload()
        {
            if (!_save.TryGetGamePayload<RenegadeSavePayload>(out var payload)) return;
            _restoring = true;
            try
            {
                if (payload.weapons != null)
                {
                    for (var i = 0; i < payload.weapons.Count; i++)
                    {
                        var snapshot = payload.weapons[i];
                        var weapon = _arsenal.Loadout.Find(snapshot.weaponId);
                        weapon?.RestoreAmmo(snapshot.magazine, snapshot.reserve);
                    }
                }

                var activeIndex = -1;
                for (var i = 0; i < _arsenal.Loadout.Weapons.Count; i++)
                {
                    if (string.Equals(_arsenal.Loadout.Weapons[i].Definition.weaponId, payload.activeWeaponId, StringComparison.OrdinalIgnoreCase))
                    {
                        activeIndex = i;
                        break;
                    }
                }
                if (activeIndex >= 0) _arsenal.Loadout.EquipIndex(activeIndex);
                _escalation.Pressure.Set(payload.pressure);
                _escalation.Refusal.Set(payload.refusal);
            }
            finally
            {
                _restoring = false;
            }
        }

        private void Subscribe()
        {
            _save.CheckpointChanged += OnCheckpointChanged;
            _arsenal.WeaponChanged += OnWeaponChanged;
            _arsenal.Loadout.AmmoAdded += OnAmmoChanged;
            for (var i = 0; i < _arsenal.Loadout.Weapons.Count; i++)
            {
                var weapon = _arsenal.Loadout.Weapons[i];
                weapon.Fired += OnWeaponFired;
                weapon.ReloadCompleted += OnReloadCompleted;
            }
            _escalation.Pressure.ValueChanged += OnEscalationChanged;
            _escalation.Refusal.ValueChanged += OnEscalationChanged;
        }

        private void Update()
        {
            if (!_ready || _restoring || Time.unscaledTime < _nextPeriodicSave) return;
            _nextPeriodicSave = Time.unscaledTime + 8f;
            SavePayload(false);
            _save.Save();
        }

        private void OnCheckpointChanged(ApexCheckpointData _) => SavePayload(true);
        private void OnWeaponChanged(ApexWeaponRuntime _) => SavePayload(false);
        private void OnAmmoChanged(ApexWeaponRuntime _, int __) => SavePayload(false);
        private void OnWeaponFired(WeaponShot _) => _nextPeriodicSave = Mathf.Min(_nextPeriodicSave, Time.unscaledTime + 2f);
        private void OnReloadCompleted() => SavePayload(false);
        private void OnEscalationChanged(float _) => _nextPeriodicSave = Mathf.Min(_nextPeriodicSave, Time.unscaledTime + 2f);

        public void SavePayload(bool immediate)
        {
            if (_save == null || _arsenal?.Loadout == null || _escalation?.Pressure == null || _restoring) return;
            var payload = new RenegadeSavePayload
            {
                activeWeaponId = _arsenal.ActiveWeapon?.Definition.weaponId ?? "corona-blaster",
                pressure = _escalation.Pressure.Value,
                refusal = _escalation.Refusal.Value,
                weapons = new List<RenegadeWeaponSaveData>(_arsenal.Loadout.Count)
            };

            for (var i = 0; i < _arsenal.Loadout.Weapons.Count; i++)
            {
                var weapon = _arsenal.Loadout.Weapons[i];
                payload.weapons.Add(new RenegadeWeaponSaveData
                {
                    weaponId = weapon.Definition.weaponId,
                    magazine = weapon.Magazine,
                    reserve = weapon.Reserve
                });
            }
            _save.SetGamePayload(payload, immediate);
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused && _ready) SavePayload(true);
        }

        private void OnApplicationQuit()
        {
            if (_ready) SavePayload(true);
        }

        private void OnDestroy()
        {
            if (_save != null) _save.CheckpointChanged -= OnCheckpointChanged;
            if (_arsenal != null)
            {
                _arsenal.WeaponChanged -= OnWeaponChanged;
                if (_arsenal.Loadout != null)
                {
                    _arsenal.Loadout.AmmoAdded -= OnAmmoChanged;
                    for (var i = 0; i < _arsenal.Loadout.Weapons.Count; i++)
                    {
                        var weapon = _arsenal.Loadout.Weapons[i];
                        weapon.Fired -= OnWeaponFired;
                        weapon.ReloadCompleted -= OnReloadCompleted;
                    }
                }
            }
            if (_escalation?.Pressure != null) _escalation.Pressure.ValueChanged -= OnEscalationChanged;
            if (_escalation?.Refusal != null) _escalation.Refusal.ValueChanged -= OnEscalationChanged;
        }
    }
}
