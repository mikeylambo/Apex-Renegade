using System.Collections.Generic;
using Apex.World;
using UnityEditor;
using UnityEngine;

namespace Apex.Renegade.EditorFoundry
{
    public static class ApexRenegadeWorldPreset
    {
        private const string Directory = "Assets/ApexPort/World";
        private const string AssetPath = Directory + "/ApexRenegadeWorldSpine.asset";

        [MenuItem("Apex/Renegade/Create or Refresh World Spine Definition")]
        public static void CreateOrRefresh()
        {
            System.IO.Directory.CreateDirectory(Directory);
            var asset = AssetDatabase.LoadAssetAtPath<ApexWorldSpineDefinition>(AssetPath);
            if (asset == null)
            {
                asset = ScriptableObject.CreateInstance<ApexWorldSpineDefinition>();
                AssetDatabase.CreateAsset(asset, AssetPath);
            }

            asset.worldId = "apex-renegade-world-spine";
            asset.regions = new List<ApexWorldRegionDefinition>
            {
                new()
                {
                    id = "scar",
                    displayName = "The Scar",
                    bounds = new Bounds(new Vector3(0f, 230f, 80f), new Vector3(1450f, 520f, 1500f)),
                    streamLoadRadius = 980f,
                    streamUnloadRadius = 1220f,
                    visualPriority = 3,
                    terrainRegion = false,
                    allowFlight = true,
                    armyScale = true
                },
                new()
                {
                    id = "expanse",
                    displayName = "The Expanse",
                    bounds = new Bounds(new Vector3(0f, 100f, -1600f), new Vector3(1800f, 200f, 2200f)),
                    streamLoadRadius = 1200f,
                    streamUnloadRadius = 1500f,
                    visualPriority = 2,
                    terrainRegion = true,
                    allowFlight = true,
                    armyScale = true
                },
                new()
                {
                    id = "vertical-megacity",
                    displayName = "Vertical Megacity",
                    bounds = new Bounds(new Vector3(0f, 620f, -3800f), new Vector3(1900f, 1500f, 2400f)),
                    streamLoadRadius = 1450f,
                    streamUnloadRadius = 1800f,
                    visualPriority = 4,
                    terrainRegion = false,
                    allowFlight = true,
                    armyScale = true
                }
            };

            asset.landmarks = new List<ApexWorldLandmarkDefinition>
            {
                new() { id = "scar-containment-gantry", displayName = "Containment Gantry", position = new Vector3(0f, 38f, 80f), visibilityRadius = 1300f },
                new() { id = "expanse-relic", displayName = "Containment Relic", position = new Vector3(-520f, 125f, -1850f), visibilityRadius = 2600f },
                new() { id = "vertical-gate", displayName = "Vertical Gate", position = new Vector3(0f, 180f, -3050f), visibilityRadius = 2600f },
                new() { id = "central-needle", displayName = "Central Needle", position = new Vector3(0f, 760f, -4150f), visibilityRadius = 4800f }
            };

            asset.corridors = new List<ApexTravelCorridorDefinition>
            {
                new()
                {
                    id = "scar-expanse-highway",
                    start = new Vector3(0f, 0f, -520f),
                    end = new Vector3(0f, 0f, -2750f),
                    width = 62f,
                    flatShoulder = 14f,
                    transitionWidth = 150f,
                    terrainConforms = true
                },
                new()
                {
                    id = "vertical-approach",
                    start = new Vector3(0f, 0f, -2700f),
                    end = new Vector3(0f, 0f, -3320f),
                    width = 92f,
                    flatShoulder = 18f,
                    transitionWidth = 170f,
                    terrainConforms = false
                }
            };

            asset.Sanitize();
            EditorUtility.SetDirty(asset);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Selection.activeObject = asset;
            EditorGUIUtility.PingObject(asset);
            Debug.Log($"[Apex World Foundry] Apex Renegade world-spine definition ready: {AssetPath}");
        }
    }
}
