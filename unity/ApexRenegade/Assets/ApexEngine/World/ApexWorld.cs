using System;
using UnityEngine;

namespace Apex.World
{
    [Serializable]
    public struct ApexRegionDescriptor
    {
        public string id;
        public Bounds bounds;
        public int visualPriority;
        public float simulationRadius;
    }

    public sealed class ApexRegionVolume : MonoBehaviour
    {
        [SerializeField] private string regionId = "region";
        [SerializeField] private Vector3 size = new(500f, 500f, 500f);
        public string RegionId => regionId;
        public Bounds Bounds => new(transform.position, size);

        public void Configure(string id, Vector3 worldSize)
        {
            regionId = id;
            size = worldSize;
        }

        public bool Contains(Vector3 point) => Bounds.Contains(point);

#if UNITY_EDITOR
        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.55f, 0.45f, 1f, 0.22f);
            Gizmos.DrawWireCube(transform.position, size);
        }
#endif
    }

    public interface IApexWorldStreamer
    {
        string ActiveRegion { get; }
        void SetObserver(Transform observer);
    }

    public sealed class ApexWorldRegionTracker : MonoBehaviour, IApexWorldStreamer
    {
        [SerializeField] private ApexRegionVolume[] regions;
        private Transform _observer;
        public string ActiveRegion { get; private set; } = string.Empty;
        public event Action<string> RegionChanged;

        public void Configure(ApexRegionVolume[] regionVolumes) => regions = regionVolumes;
        public void SetObserver(Transform observer) => _observer = observer;

        private void Update()
        {
            if (_observer == null || regions == null) return;
            var next = string.Empty;
            foreach (var region in regions)
            {
                if (region != null && region.Contains(_observer.position))
                {
                    next = region.RegionId;
                    break;
                }
            }
            if (next == ActiveRegion) return;
            ActiveRegion = next;
            RegionChanged?.Invoke(next);
        }
    }
}
