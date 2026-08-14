using System;
using System.Collections.Generic;
using UnityEngine;

namespace Apex.World
{
    [Serializable]
    public sealed class ApexWorldRegionDefinition
    {
        public string id = "region";
        public string displayName = "Region";
        public Bounds bounds = new(Vector3.zero, new Vector3(500f, 300f, 500f));
        public float streamLoadRadius = 900f;
        public float streamUnloadRadius = 1100f;
        public int visualPriority;
        public bool terrainRegion;
        public bool allowFlight = true;
        public bool armyScale = true;

        public void Sanitize()
        {
            id = string.IsNullOrWhiteSpace(id) ? "region" : id.Trim();
            displayName = string.IsNullOrWhiteSpace(displayName) ? id : displayName.Trim();
            bounds.size = new Vector3(
                Mathf.Max(1f, bounds.size.x),
                Mathf.Max(1f, bounds.size.y),
                Mathf.Max(1f, bounds.size.z));
            streamLoadRadius = Mathf.Max(25f, streamLoadRadius);
            streamUnloadRadius = Mathf.Max(streamLoadRadius + 25f, streamUnloadRadius);
        }
    }

    [Serializable]
    public sealed class ApexWorldLandmarkDefinition
    {
        public string id = "landmark";
        public string displayName = "Landmark";
        public Vector3 position;
        public float visibilityRadius = 2500f;
        public bool navigationTarget = true;
        public bool physicalAtCloseRange = true;
    }

    [Serializable]
    public sealed class ApexTravelCorridorDefinition
    {
        public string id = "corridor";
        public Vector3 start;
        public Vector3 end = new(0f, 0f, -1000f);
        public float width = 60f;
        public float flatShoulder = 24f;
        public float transitionWidth = 130f;
        public bool terrainConforms = true;
    }

    [CreateAssetMenu(menuName = "Apex/World/World Spine Definition", fileName = "ApexWorldSpine")]
    public sealed class ApexWorldSpineDefinition : ScriptableObject
    {
        public string worldId = "apex-world";
        public List<ApexWorldRegionDefinition> regions = new();
        public List<ApexWorldLandmarkDefinition> landmarks = new();
        public List<ApexTravelCorridorDefinition> corridors = new();

        public void Sanitize()
        {
            worldId = string.IsNullOrWhiteSpace(worldId) ? "apex-world" : worldId.Trim();
            foreach (var region in regions) region?.Sanitize();
        }

        public ApexWorldRegionDefinition FindRegion(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return null;
            for (var i = 0; i < regions.Count; i++)
                if (regions[i] != null && string.Equals(regions[i].id, id, StringComparison.OrdinalIgnoreCase))
                    return regions[i];
            return null;
        }
    }
}
