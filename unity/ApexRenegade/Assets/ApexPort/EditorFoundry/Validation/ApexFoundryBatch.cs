using System;
using System.Linq;
using Apex.EditorTools;
using Apex.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Apex.Renegade.EditorFoundry.Validation
{
    public static class ApexFoundryBatch
    {
        private const string WorldPath = "Assets/ApexPort/World/ApexRenegadeWorldSpine.asset";
        private const string ValidationScenePath = "Assets/ApexPort/World/FoundryValidation.unity";

        public static void Validate()
        {
            ApexRenegadeWorldPreset.CreateOrRefresh();
            var world = AssetDatabase.LoadAssetAtPath<ApexWorldSpineDefinition>(WorldPath);
            if (world == null) throw new InvalidOperationException("Apex Renegade world-spine definition was not generated.");
            world.Sanitize();

            if (world.regions.Count < 3) throw new InvalidOperationException("Expected Scar, Expanse and Vertical Megacity regions.");
            if (world.landmarks.Count < 4) throw new InvalidOperationException("Expected the major world-spine landmarks.");
            if (world.corridors.Count < 2) throw new InvalidOperationException("Expected the highway and Vertical approach corridors.");

            var expanse = world.FindRegion("expanse") ?? throw new InvalidOperationException("Expanse region missing from world definition.");
            if (!expanse.terrainRegion) throw new InvalidOperationException("Expanse is not marked as terrain-backed.");
            var corridor = world.corridors.FirstOrDefault(c => c != null && c.id == "scar-expanse-highway")
                           ?? throw new InvalidOperationException("Scar–Expanse highway corridor missing.");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var terrain = ApexTerrainCorridorBaker.Bake(world, expanse, corridor, 257);
            if (terrain == null || terrain.terrainData == null) throw new InvalidOperationException("Terrain baker returned no TerrainData.");
            if (terrain.terrainData.heightmapResolution != 257) throw new InvalidOperationException($"Unexpected terrain resolution: {terrain.terrainData.heightmapResolution}");
            if (terrain.GetComponent<TerrainCollider>()?.terrainData == null) throw new InvalidOperationException("TerrainCollider was not authored.");

            EditorSceneManager.SaveScene(scene, ValidationScenePath);
            var report = ApexSceneAudit.BuildReport(scene, world);
            if (string.IsNullOrWhiteSpace(report) || !report.Contains("APEX WORLD FOUNDRY"))
                throw new InvalidOperationException("World audit did not produce the expected report.");

            Debug.Log($"[Apex World Foundry] PASS // world={world.worldId} // regions={world.regions.Count} // terrain={terrain.terrainData.size} // resolution={terrain.terrainData.heightmapResolution}");
            AssetDatabase.SaveAssets();
        }
    }
}
