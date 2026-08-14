using System.Collections.Generic;
using Apex.AI;
using Apex.Combat;
using Apex.Encounter;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeEncounterSpawner : MonoBehaviour, IEncounterSpawnAdapter
    {
        private readonly HashSet<RenegadeEnemyAgent> _living = new();
        private Transform _target;
        private RenegadeArsenalController _arsenal;
        private int _sequence;

        public int LivingCount => _living.Count;
        public int TotalSpawned { get; private set; }
        public int TotalKilled { get; private set; }

        public void Configure(Transform target, RenegadeArsenalController arsenal)
        {
            _target = target;
            _arsenal = arsenal;
        }

        public void Spawn(string archetypeTag, Vector3 origin)
        {
            if (_target == null || _arsenal == null) return;
            _sequence++;
            TotalSpawned++;

            var enforcer = string.Equals(archetypeTag, "enforcer", System.StringComparison.OrdinalIgnoreCase);
            var angle = (_sequence * 137.508f) * Mathf.Deg2Rad;
            var radius = enforcer ? 24f + (_sequence % 3) * 5f : 17f + (_sequence % 4) * 6f;
            var position = origin + new Vector3(Mathf.Cos(angle) * radius, 1f, Mathf.Sin(angle) * radius - 18f);

            var go = GameObject.CreatePrimitive(enforcer ? PrimitiveType.Cube : PrimitiveType.Capsule);
            go.name = enforcer ? $"Enforcer // {_sequence:00}" : $"Hollow // {_sequence:00}";
            go.transform.SetParent(transform);
            go.transform.position = position;
            go.transform.localScale = enforcer ? new Vector3(1.25f, 2.0f, 1.05f) : new Vector3(0.78f, 1.15f, 0.78f);
            if (go.TryGetComponent<Collider>(out var primitiveCollider)) Destroy(primitiveCollider);

            var material = enforcer
                ? ApexPortMaterialFactory.Create($"Enforcer {_sequence:00}", new Color(0.085f, 0.065f, 0.06f), 0.55f, new Color(0.35f, 0.11f, 0.025f))
                : ApexPortMaterialFactory.Create($"Hollow {_sequence:00}", new Color(0.055f, 0.07f, 0.095f), 0.35f, new Color(0.08f, 0.04f, 0.22f));
            if (go.TryGetComponent<Renderer>(out var renderer)) renderer.material = material;

            var controller = go.AddComponent<CharacterController>();
            controller.height = enforcer ? 2.4f : 2.0f;
            controller.radius = enforcer ? 0.62f : 0.45f;
            controller.center = new Vector3(0f, controller.height * 0.5f, 0f);
            go.AddComponent<HealthComponent>();
            go.AddComponent<ApexAgentMotor>();
            var enemy = go.AddComponent<RenegadeEnemyAgent>();
            enemy.Configure(_target, enforcer, material);
            enemy.Killed += OnKilled;
            _arsenal.RegisterTarget(enemy);
            _living.Add(enemy);
        }

        private void OnKilled(RenegadeEnemyAgent enemy)
        {
            if (enemy == null) return;
            enemy.Killed -= OnKilled;
            _arsenal?.UnregisterTarget(enemy);
            if (_living.Remove(enemy)) TotalKilled++;
        }

        private void OnDestroy()
        {
            foreach (var enemy in _living)
            {
                if (enemy == null) continue;
                enemy.Killed -= OnKilled;
                _arsenal?.UnregisterTarget(enemy);
            }
            _living.Clear();
        }
    }
}
