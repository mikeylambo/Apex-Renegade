using System.Collections;
using Apex.Debugging;
using Apex.Encounter;
using Apex.Traversal;
using UnityEngine;
using UnityEngine.Rendering;
using Graphics = UnityEngine.Graphics;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(180)]
    public sealed class RenegadeWarField : MonoBehaviour, IApexAdaptiveBudgetConsumer
    {
        private const int MaxBatch = 1023;
        private readonly Matrix4x4[] _lightMatrices = new Matrix4x4[MaxBatch];
        private readonly Matrix4x4[] _distantMatrices = new Matrix4x4[MaxBatch];
        private ApexThreatPopulationModel _population;
        private RenegadeEscalationDirector _escalation;
        private RenegadeEncounterSpawner _spawner;
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private Mesh _mesh;
        private Material _lightMaterial;
        private Material _distantMaterial;
        private Terrain _terrain;
        private ApexPopulationBudget _budget;
        private float _performanceScale = 1f;
        private float _nextRebuild;
        private Vector3 _lastAnchor = new(float.PositiveInfinity, 0f, 0f);
        private int _lightCount;
        private int _distantCount;

        public int LightweightCount => _lightCount;
        public int DistantCount => _distantCount;
        public int ActiveCount => _spawner?.LivingCount ?? 0;
        public int VisibleContacts => ActiveCount + LightweightCount + DistantCount;
        public ApexPopulationBudget CurrentBudget => _budget;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureField()
        {
            if (Object.FindFirstObjectByType<RenegadeWarField>() != null) return;
            new GameObject("Apex War Field // Lightweight Threat Tiers").AddComponent<RenegadeWarField>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            _population = new ApexThreatPopulationModel(
                new ApexPopulationBudget(5, 24, 90),
                new ApexPopulationBudget(10, 50, 180),
                new ApexPopulationBudget(18, 90, 340),
                new ApexPopulationBudget(28, 150, 560),
                new ApexPopulationBudget(40, 220, 820));

            for (var i = 0; i < 180; i++)
            {
                _escalation = Object.FindFirstObjectByType<RenegadeEscalationDirector>();
                _spawner = Object.FindFirstObjectByType<RenegadeEncounterSpawner>();
                _player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                _terrain = Object.FindFirstObjectByType<Terrain>();
                if (_escalation?.Pressure != null && _spawner != null && _player != null && _bike != null)
                {
                    BuildRenderResources();
                    _escalation.Pressure.StageChanged += _ => ForceRebuild();
                    ForceRebuild();
                    yield break;
                }
                yield return null;
            }
            Debug.LogWarning("[Apex War Field] Could not resolve runtime dependencies.");
        }

        private void BuildRenderResources()
        {
            var probe = GameObject.CreatePrimitive(PrimitiveType.Cube);
            probe.name = "Apex War Field Mesh Probe";
            _mesh = probe.GetComponent<MeshFilter>().sharedMesh;
            Destroy(probe);

            _lightMaterial = ApexPortMaterialFactory.Create(
                "Lightweight Threat Contact",
                new Color(0.055f, 0.065f, 0.085f),
                0.25f,
                new Color(0.08f, 0.035f, 0.19f));
            _distantMaterial = ApexPortMaterialFactory.Create(
                "Distant Threat Formation",
                new Color(0.025f, 0.032f, 0.045f),
                0.12f,
                new Color(0.035f, 0.022f, 0.08f));
            _lightMaterial.enableInstancing = true;
            _distantMaterial.enableInstancing = true;
        }

        private void Update()
        {
            if (_mesh == null || _escalation?.Pressure == null) return;
            var anchor = ObserverPosition();
            if (Time.unscaledTime < _nextRebuild && Vector3.Distance(anchor, _lastAnchor) < 45f) return;
            _nextRebuild = Time.unscaledTime + 0.22f;
            _lastAnchor = anchor;
            RebuildMatrices(anchor);
        }

        private void LateUpdate()
        {
            if (_mesh == null || Application.isBatchMode) return;
            if (_lightCount > 0)
                Graphics.DrawMeshInstanced(_mesh, 0, _lightMaterial, _lightMatrices, _lightCount, null, ShadowCastingMode.Off, false, 0, null, LightProbeUsage.Off);
            if (_distantCount > 0)
                Graphics.DrawMeshInstanced(_mesh, 0, _distantMaterial, _distantMatrices, _distantCount, null, ShadowCastingMode.Off, false, 0, null, LightProbeUsage.Off);
        }

        private void RebuildMatrices(Vector3 anchor)
        {
            var stage = _escalation.Pressure.StageIndex;
            _budget = _population.ForStage(stage, _performanceScale);
            _lightCount = Mathf.Min(MaxBatch, _budget.Lightweight);
            _distantCount = Mathf.Min(MaxBatch, _budget.Distant);
            var forward = ObserverForward();
            var right = Vector3.Cross(Vector3.up, forward).normalized;
            var time = Time.unscaledTime;

            for (var i = 0; i < _lightCount; i++)
            {
                var u = Hash01(i * 17 + 11);
                var v = Hash01(i * 31 + 7);
                var side = Mathf.Lerp(-1f, 1f, u);
                var distance = Mathf.Lerp(58f, 285f, v);
                var depth = distance * Mathf.Lerp(0.45f, 1.05f, Hash01(i * 13 + 3));
                var lateral = side * Mathf.Lerp(38f, 210f, Hash01(i * 29 + 19));
                var drift = Mathf.Sin(time * 0.35f + i * 1.73f) * 4f;
                var position = anchor + forward * depth + right * (lateral + drift);
                position.y = GroundHeight(position) + 1.1f;
                var heading = Quaternion.Euler(0f, Hash01(i * 47 + 5) * 360f, 0f);
                var scale = new Vector3(0.7f, 1.8f + Hash01(i * 23) * 0.8f, 0.65f);
                _lightMatrices[i] = Matrix4x4.TRS(position, heading, scale);
            }

            for (var i = 0; i < _distantCount; i++)
            {
                var angle = Hash01(i * 43 + 17) * Mathf.PI * 2f;
                var radius = Mathf.Lerp(320f, 1050f, Hash01(i * 71 + 13));
                var forwardBias = Mathf.Lerp(0.55f, 1f, Hash01(i * 37 + 2));
                var position = anchor
                               + forward * (Mathf.Cos(angle) * radius * forwardBias + radius * 0.38f)
                               + right * (Mathf.Sin(angle) * radius);
                position.y = GroundHeight(position) + 2.2f;
                var scaleY = Mathf.Lerp(2.2f, 5.5f, Hash01(i * 59 + 23));
                _distantMatrices[i] = Matrix4x4.TRS(position, Quaternion.identity, new Vector3(1.1f, scaleY, 1.1f));
            }
        }

        private float GroundHeight(Vector3 position)
        {
            if (_terrain == null || _terrain.terrainData == null) return 0f;
            var t = _terrain.transform.position;
            var size = _terrain.terrainData.size;
            if (position.x < t.x || position.x > t.x + size.x || position.z < t.z || position.z > t.z + size.z) return 0f;
            return _terrain.SampleHeight(position) + t.y;
        }

        private Vector3 ObserverPosition() => _bike != null && _bike.IsMounted ? _bike.transform.position : _player.transform.position;
        private Vector3 ObserverForward()
        {
            var f = _bike != null && _bike.IsMounted ? _bike.transform.forward : _player.transform.forward;
            f.y = 0f;
            return f.sqrMagnitude > 0.001f ? f.normalized : Vector3.forward;
        }

        private static float Hash01(int seed)
        {
            unchecked
            {
                var x = (uint)seed;
                x ^= x >> 16;
                x *= 0x7feb352d;
                x ^= x >> 15;
                x *= 0x846ca68b;
                x ^= x >> 16;
                return (x & 0x00ffffff) / 16777215f;
            }
        }

        private void ForceRebuild()
        {
            _nextRebuild = 0f;
            _lastAnchor = new Vector3(float.PositiveInfinity, 0f, 0f);
        }

        public void OnPerformanceStateChanged(ApexPerformanceState state)
        {
            _performanceScale = state switch
            {
                ApexPerformanceState.Critical => 0.35f,
                ApexPerformanceState.Constrained => 0.65f,
                _ => 1f
            };
            ForceRebuild();
        }

        private void OnDestroy()
        {
            if (_lightMaterial != null) Destroy(_lightMaterial);
            if (_distantMaterial != null) Destroy(_distantMaterial);
        }
    }
}
