using System;
using System.IO;
using Apex.Core;
using UnityEngine;

namespace Apex.Save
{
    [Serializable]
    public sealed class ApexCheckpointData
    {
        public bool valid;
        public string checkpointId = "start";
        public string regionId = "";
        public Vector3 position;
        public Vector3 eulerRotation;
        public int progressionTier;
        public long timestampUtcTicks;
    }

    [Serializable]
    public sealed class ApexSaveData
    {
        public int version = 2;
        public ApexCheckpointData checkpoint = new();
        public string gamePayloadJson = "{}";
    }

    public sealed class ApexSaveService : IApexService
    {
        private const string FileName = "apex-save-0.json";
        private string _path;
        public ApexSaveData Data { get; private set; } = new();
        public bool HasCheckpoint => Data?.checkpoint != null && Data.checkpoint.valid;
        public event Action<ApexCheckpointData> CheckpointChanged;
        public event Action GamePayloadChanged;

        public void Initialize(ApexServices services)
        {
            _path = Path.Combine(Application.persistentDataPath, FileName);
            Load();
            services.Register(this);
        }

        public void SetCheckpoint(string id, string region, Vector3 position, Quaternion rotation, int progressionTier = 0)
        {
            Data.checkpoint = new ApexCheckpointData
            {
                valid = true,
                checkpointId = string.IsNullOrWhiteSpace(id) ? "checkpoint" : id,
                regionId = region ?? string.Empty,
                position = position,
                eulerRotation = rotation.eulerAngles,
                progressionTier = Mathf.Max(0, progressionTier),
                timestampUtcTicks = DateTime.UtcNow.Ticks
            };
            Save();
            CheckpointChanged?.Invoke(Data.checkpoint);
        }

        public bool TryGetRespawn(out Vector3 position, out Quaternion rotation)
        {
            if (!HasCheckpoint)
            {
                position = default;
                rotation = Quaternion.identity;
                return false;
            }
            position = Data.checkpoint.position;
            rotation = Quaternion.Euler(Data.checkpoint.eulerRotation);
            return true;
        }

        public void SetGamePayload<T>(T payload, bool saveImmediately = true) where T : class
        {
            if (payload == null) throw new ArgumentNullException(nameof(payload));
            Data.gamePayloadJson = JsonUtility.ToJson(payload);
            GamePayloadChanged?.Invoke();
            if (saveImmediately) Save();
        }

        public bool TryGetGamePayload<T>(out T payload) where T : class, new()
        {
            payload = new T();
            var json = Data?.gamePayloadJson;
            if (string.IsNullOrWhiteSpace(json) || json == "{}") return false;
            try
            {
                payload = JsonUtility.FromJson<T>(json) ?? new T();
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Apex.Save] Game payload parse failed for {typeof(T).Name}: {ex.Message}");
                payload = new T();
                return false;
            }
        }

        public void ClearGamePayload(bool saveImmediately = true)
        {
            Data.gamePayloadJson = "{}";
            GamePayloadChanged?.Invoke();
            if (saveImmediately) Save();
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_path) ?? Application.persistentDataPath);
                File.WriteAllText(_path, JsonUtility.ToJson(Data, true));
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Apex.Save] Save failed: {ex.Message}");
            }
        }

        public void Load()
        {
            try
            {
                Data = File.Exists(_path) ? JsonUtility.FromJson<ApexSaveData>(File.ReadAllText(_path)) ?? new ApexSaveData() : new ApexSaveData();
                Data.checkpoint ??= new ApexCheckpointData();
                Data.gamePayloadJson ??= "{}";
                Data.version = Mathf.Max(2, Data.version);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Apex.Save] Load failed: {ex.Message}");
                Data = new ApexSaveData();
            }
        }

        public void DeleteSave()
        {
            Data = new ApexSaveData();
            try { if (File.Exists(_path)) File.Delete(_path); } catch (Exception ex) { Debug.LogWarning(ex.Message); }
        }

        public void Shutdown() => Save();
    }

    public sealed class ApexCheckpoint : MonoBehaviour
    {
        [SerializeField] private string checkpointId = "checkpoint";
        [SerializeField] private string regionId = "";
        [SerializeField] private int progressionTier;
        [SerializeField] private bool activateOnce = true;
        private bool _activated;

        public void Configure(string id, string region, int tier = 0, bool once = true)
        {
            checkpointId = id;
            regionId = region;
            progressionTier = Mathf.Max(0, tier);
            activateOnce = once;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (_activated && activateOnce) return;
            if (!other.TryGetComponent<ApexFirstPersonMarker>(out _) && other.GetComponentInParent<ApexFirstPersonMarker>() == null) return;
            if (!ApexRuntime.IsInitialized || !ApexRuntime.Services.TryGet<ApexSaveService>(out var save)) return;
            save.SetCheckpoint(checkpointId, regionId, transform.position, transform.rotation, progressionTier);
            _activated = true;
        }
    }

    // Small generic marker keeps checkpoint triggers independent of any game-specific player class.
    public sealed class ApexFirstPersonMarker : MonoBehaviour { }
}
