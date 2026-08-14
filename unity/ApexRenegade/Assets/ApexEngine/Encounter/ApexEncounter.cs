using System;
using System.Collections.Generic;
using UnityEngine;

namespace Apex.Encounter
{
    public enum EncounterState { Dormant, Primed, Active, Complete, Failed }

    [Serializable]
    public sealed class EncounterWave
    {
        public string id = "wave";
        [Min(0)] public int targetCount = 5;
        [Min(0f)] public float reinforcementDelay = 1.5f;
        [Min(1)] public int maxSimultaneous = 8;
        public string archetypeTag = "standard";
    }

    [CreateAssetMenu(menuName = "Apex/Encounter Definition", fileName = "EncounterDefinition")]
    public sealed class EncounterDefinition : ScriptableObject
    {
        public string encounterId = "encounter";
        public bool autoStart = true;
        public List<EncounterWave> waves = new();
    }

    public interface IEncounterSpawnAdapter
    {
        int LivingCount { get; }
        void Spawn(string archetypeTag, Vector3 origin);
    }

    public sealed class ApexEncounterController : MonoBehaviour
    {
        [SerializeField] private EncounterDefinition definition;
        [SerializeField] private Transform spawnOrigin;
        public EncounterState State { get; private set; } = EncounterState.Dormant;
        public int WaveIndex { get; private set; } = -1;
        public event Action<EncounterState> StateChanged;
        public event Action<int, EncounterWave> WaveChanged;

        private IEncounterSpawnAdapter _spawner;
        private int _spawnedThisWave;
        private float _reinforcementTimer;

        public void Configure(EncounterDefinition encounter, IEncounterSpawnAdapter spawner)
        {
            definition = encounter;
            _spawner = spawner;
            State = EncounterState.Primed;
            StateChanged?.Invoke(State);
            if (definition != null && definition.autoStart) StartEncounter();
        }

        public void StartEncounter()
        {
            if (definition == null || definition.waves.Count == 0 || State == EncounterState.Active) return;
            State = EncounterState.Active;
            StateChanged?.Invoke(State);
            BeginWave(0);
        }

        public void Fail()
        {
            if (State != EncounterState.Active) return;
            State = EncounterState.Failed;
            StateChanged?.Invoke(State);
        }

        private void Update()
        {
            if (State != EncounterState.Active || _spawner == null || WaveIndex < 0 || WaveIndex >= definition.waves.Count) return;
            var wave = definition.waves[WaveIndex];
            _reinforcementTimer -= Time.deltaTime;

            if (_spawnedThisWave < wave.targetCount && _spawner.LivingCount < wave.maxSimultaneous && _reinforcementTimer <= 0f)
            {
                _spawner.Spawn(wave.archetypeTag, spawnOrigin != null ? spawnOrigin.position : transform.position);
                _spawnedThisWave++;
                _reinforcementTimer = wave.reinforcementDelay;
            }

            if (_spawnedThisWave >= wave.targetCount && _spawner.LivingCount <= 0)
            {
                if (WaveIndex + 1 < definition.waves.Count) BeginWave(WaveIndex + 1);
                else
                {
                    State = EncounterState.Complete;
                    StateChanged?.Invoke(State);
                }
            }
        }

        private void BeginWave(int index)
        {
            WaveIndex = index;
            _spawnedThisWave = 0;
            _reinforcementTimer = 0f;
            WaveChanged?.Invoke(index, definition.waves[index]);
        }
    }
}
