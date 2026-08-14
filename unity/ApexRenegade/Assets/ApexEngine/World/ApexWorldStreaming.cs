using System;
using System.Collections.Generic;
using Apex.Debugging;
using UnityEngine;

namespace Apex.World
{
    public sealed class ApexWorldStreamCell : MonoBehaviour
    {
        [SerializeField] private string cellId = "cell";
        [SerializeField] private Transform contentRoot;
        [SerializeField, Min(10f)] private float loadRadius = 650f;
        [SerializeField, Min(10f)] private float unloadRadius = 780f;
        [SerializeField] private bool loaded = true;

        public string CellId => cellId;
        public Vector3 Center => transform.position;
        public bool IsLoaded => loaded;
        public float LoadRadius => loadRadius;
        public float UnloadRadius => Mathf.Max(loadRadius + 10f, unloadRadius);

        public event Action<ApexWorldStreamCell, bool> LoadStateChanged;

        public void Configure(string id, Transform content, float loadDistance, float unloadDistance, bool initiallyLoaded = true)
        {
            cellId = string.IsNullOrWhiteSpace(id) ? name : id;
            contentRoot = content;
            loadRadius = Mathf.Max(10f, loadDistance);
            unloadRadius = Mathf.Max(loadRadius + 10f, unloadDistance);
            SetLoaded(initiallyLoaded, true);
        }

        public void SetLoaded(bool value, bool force = false)
        {
            if (!force && loaded == value) return;
            loaded = value;
            if (contentRoot != null && contentRoot.gameObject.activeSelf != loaded)
                contentRoot.gameObject.SetActive(loaded);
            LoadStateChanged?.Invoke(this, loaded);
        }
    }

    public sealed class ApexWorldStreamingController : MonoBehaviour, IApexAdaptiveBudgetConsumer
    {
        [SerializeField] private Transform observer;
        [SerializeField, Range(0.05f, 1f)] private float updateInterval = 0.2f;
        private readonly List<ApexWorldStreamCell> _cells = new();
        private float _timer;
        private float _distanceScale = 1f;

        public Transform Observer => observer;
        public IReadOnlyList<ApexWorldStreamCell> Cells => _cells;
        public int LoadedCount { get; private set; }

        public void SetObserver(Transform target) => observer = target;

        public void Register(ApexWorldStreamCell cell)
        {
            if (cell != null && !_cells.Contains(cell)) _cells.Add(cell);
        }

        public void Unregister(ApexWorldStreamCell cell) => _cells.Remove(cell);

        public void DiscoverChildren()
        {
            _cells.Clear();
            GetComponentsInChildren(true, _cells);
        }

        private void Update()
        {
            if (observer == null) return;
            _timer -= Time.unscaledDeltaTime;
            if (_timer > 0f) return;
            _timer = updateInterval;

            var loaded = 0;
            var observerPosition = observer.position;
            for (var i = _cells.Count - 1; i >= 0; i--)
            {
                var cell = _cells[i];
                if (cell == null)
                {
                    _cells.RemoveAt(i);
                    continue;
                }
                var distance = Vector3.Distance(observerPosition, cell.Center);
                var loadDistance = cell.LoadRadius * _distanceScale;
                var unloadDistance = cell.UnloadRadius * _distanceScale;
                if (cell.IsLoaded)
                {
                    if (distance > unloadDistance) cell.SetLoaded(false);
                }
                else if (distance < loadDistance) cell.SetLoaded(true);
                if (cell.IsLoaded) loaded++;
            }
            LoadedCount = loaded;
        }

        public void OnPerformanceStateChanged(ApexPerformanceState state)
        {
            _distanceScale = state switch
            {
                ApexPerformanceState.Critical => 0.62f,
                ApexPerformanceState.Constrained => 0.80f,
                _ => 1f
            };
            _timer = 0f;
        }
    }
}
