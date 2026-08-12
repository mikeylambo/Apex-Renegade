using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Apex.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Apex.EditorTools
{
    public sealed class ApexWorldFoundryWindow : EditorWindow
    {
        private ApexWorldSpineDefinition _definition;
        private Vector2 _scroll;
        private string _lastReport = "No scene audit has been run.";

        [MenuItem("Apex/World Foundry")]
        public static void Open() => GetWindow<ApexWorldFoundryWindow>("Apex World Foundry");

        private void OnGUI()
        {
            EditorGUILayout.Space(8f);
            EditorGUILayout.LabelField("APEX WORLD FOUNDRY", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "Author the world as data, then let Unity bake physical terrain, region volumes, stream cells and validation reports. " +
                "The Foundry intentionally separates reusable world tooling from Apex Renegade content.",
                MessageType.Info);

            _definition = (ApexWorldSpineDefinition)EditorGUILayout.ObjectField("World Definition", _definition, typeof(ApexWorldSpineDefinition), false);

            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Create Empty Definition", GUILayout.Height(28f))) CreateEmptyDefinition();
                GUI.enabled = _definition != null;
                if (GUILayout.Button("Sanitize + Save", GUILayout.Height(28f))) SaveDefinition();
                GUI.enabled = true;
            }

            EditorGUILayout.Space(8f);
            EditorGUILayout.LabelField("Scene Authoring", EditorStyles.boldLabel);
            GUI.enabled = _definition != null;
            if (GUILayout.Button("Bake Region Volumes", GUILayout.Height(30f))) BakeRegionVolumes();
            if (GUILayout.Button("Bake Streaming Cells", GUILayout.Height(30f))) BakeStreamingCells();
            if (GUILayout.Button("Bake Terrain Corridors", GUILayout.Height(30f))) BakeTerrainCorridors();
            GUI.enabled = true;

            EditorGUILayout.Space(8f);
            EditorGUILayout.LabelField("Validation", EditorStyles.boldLabel);
            if (GUILayout.Button("Audit Current Scene", GUILayout.Height(30f))) _lastReport = ApexSceneAudit.BuildReport(SceneManager.GetActiveScene(), _definition);
            if (GUILayout.Button("Write Audit Report", GUILayout.Height(26f))) WriteAuditReport();

            _scroll = EditorGUILayout.BeginScrollView(_scroll, GUILayout.ExpandHeight(true));
            EditorGUILayout.TextArea(_lastReport, GUILayout.ExpandHeight(true));
            EditorGUILayout.EndScrollView();
        }

        private void CreateEmptyDefinition()
        {
            var path = EditorUtility.SaveFilePanelInProject("Create Apex World Definition", "ApexWorldSpine", "asset", "Choose a location for the world-spine asset.");
            if (string.IsNullOrWhiteSpace(path)) return;
            var asset = CreateInstance<ApexWorldSpineDefinition>();
            asset.worldId = "apex-world";
            AssetDatabase.CreateAsset(asset, path);
            AssetDatabase.SaveAssets();
            _definition = asset;
            Selection.activeObject = asset;
        }

        private void SaveDefinition()
        {
            _definition.Sanitize();
            EditorUtility.SetDirty(_definition);
            AssetDatabase.SaveAssets();
        }

        private void BakeRegionVolumes()
        {
            if (_definition == null) return;
            Undo.IncrementCurrentGroup();
            var group = Undo.GetCurrentGroup();
            Undo.SetCurrentGroupName("Bake Apex Region Volumes");

            var root = FindOrCreateRoot("Apex Authored Regions");
            DeleteChildren(root);
            foreach (var region in _definition.regions)
            {
                if (region == null) continue;
                region.Sanitize();
                var go = new GameObject($"Region // {region.displayName}");
                Undo.RegisterCreatedObjectUndo(go, "Create Apex Region");
                go.transform.SetParent(root, false);
                go.transform.position = region.bounds.center;
                var volume = go.AddComponent<ApexRegionVolume>();
                volume.Configure(region.id, region.bounds.size);
            }

            Undo.CollapseUndoOperations(group);
            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
        }

        private void BakeStreamingCells()
        {
            if (_definition == null) return;
            var root = FindOrCreateRoot("Apex Authored Stream Cells");
            DeleteChildren(root);
            foreach (var region in _definition.regions)
            {
                if (region == null) continue;
                region.Sanitize();
                var go = new GameObject($"Stream Cell // {region.displayName}");
                Undo.RegisterCreatedObjectUndo(go, "Create Apex Stream Cell");
                go.transform.SetParent(root, false);
                go.transform.position = region.bounds.center;
                var cell = go.AddComponent<ApexWorldStreamCell>();
                cell.Configure(region.id, region.streamLoadRadius, region.streamUnloadRadius);
            }
            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
        }

        private void BakeTerrainCorridors()
        {
            if (_definition == null) return;
            var terrains = _definition.regions.Where(r => r != null && r.terrainRegion).ToList();
            if (terrains.Count == 0)
            {
                EditorUtility.DisplayDialog("Apex World Foundry", "No terrain regions are marked in the selected definition.", "OK");
                return;
            }

            foreach (var region in terrains)
            {
                var corridor = ClosestCorridor(region.bounds.center);
                ApexTerrainCorridorBaker.Bake(_definition, region, corridor);
            }
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
        }

        private ApexTravelCorridorDefinition ClosestCorridor(Vector3 point)
        {
            ApexTravelCorridorDefinition best = null;
            var bestDistance = float.PositiveInfinity;
            foreach (var corridor in _definition.corridors)
            {
                if (corridor == null) continue;
                var midpoint = (corridor.start + corridor.end) * 0.5f;
                var distance = (midpoint - point).sqrMagnitude;
                if (distance >= bestDistance) continue;
                bestDistance = distance;
                best = corridor;
            }
            return best;
        }

        private void WriteAuditReport()
        {
            if (string.IsNullOrWhiteSpace(_lastReport)) _lastReport = ApexSceneAudit.BuildReport(SceneManager.GetActiveScene(), _definition);
            const string directory = "Assets/ApexReports";
            Directory.CreateDirectory(directory);
            var sceneName = SceneManager.GetActiveScene().name;
            var path = $"{directory}/{(string.IsNullOrWhiteSpace(sceneName) ? "Untitled" : sceneName)}-world-audit.txt";
            File.WriteAllText(path, _lastReport);
            AssetDatabase.ImportAsset(path);
            Selection.activeObject = AssetDatabase.LoadAssetAtPath<TextAsset>(path);
        }

        private static Transform FindOrCreateRoot(string name)
        {
            var existing = GameObject.Find(name);
            if (existing != null) return existing.transform;
            var go = new GameObject(name);
            Undo.RegisterCreatedObjectUndo(go, $"Create {name}");
            return go.transform;
        }

        private static void DeleteChildren(Transform root)
        {
            var children = new List<GameObject>();
            for (var i = 0; i < root.childCount; i++) children.Add(root.GetChild(i).gameObject);
            foreach (var child in children) Undo.DestroyObjectImmediate(child);
        }
    }

    public static class ApexSceneAudit
    {
        public static string BuildReport(Scene scene, ApexWorldSpineDefinition definition)
        {
            if (!scene.IsValid()) return "INVALID SCENE";
            var roots = scene.GetRootGameObjects();
            var renderers = roots.SelectMany(r => r.GetComponentsInChildren<Renderer>(true)).ToArray();
            var colliders = roots.SelectMany(r => r.GetComponentsInChildren<Collider>(true)).ToArray();
            var terrainColliders = roots.SelectMany(r => r.GetComponentsInChildren<TerrainCollider>(true)).ToArray();
            var lights = roots.SelectMany(r => r.GetComponentsInChildren<Light>(true)).ToArray();
            var terrains = roots.SelectMany(r => r.GetComponentsInChildren<Terrain>(true)).ToArray();
            var cells = roots.SelectMany(r => r.GetComponentsInChildren<ApexWorldStreamCell>(true)).ToArray();
            var regions = roots.SelectMany(r => r.GetComponentsInChildren<ApexRegionVolume>(true)).ToArray();

            var visibleBounds = new Bounds();
            var haveBounds = false;
            var missingPhysical = new List<string>();
            foreach (var renderer in renderers)
            {
                if (renderer == null) continue;
                if (!haveBounds) { visibleBounds = renderer.bounds; haveBounds = true; }
                else visibleBounds.Encapsulate(renderer.bounds);

                var size = renderer.bounds.size;
                var major = Mathf.Max(size.x, Mathf.Max(size.y, size.z)) >= 12f;
                if (!major) continue;
                if (renderer.GetComponentInParent<Collider>() != null) continue;
                if (renderer.GetComponentInChildren<Collider>() != null) continue;
                missingPhysical.Add(GetHierarchyPath(renderer.transform));
            }

            var report = new System.Text.StringBuilder(4096);
            report.AppendLine("APEX WORLD FOUNDRY // SCENE AUDIT");
            report.AppendLine($"Scene: {scene.name}");
            report.AppendLine($"Unity: {Application.unityVersion}");
            report.AppendLine($"Roots: {roots.Length}");
            report.AppendLine($"Renderers: {renderers.Length}");
            report.AppendLine($"Colliders: {colliders.Length} + TerrainColliders {terrainColliders.Length}");
            report.AppendLine($"Lights: {lights.Length}");
            report.AppendLine($"Terrains: {terrains.Length}");
            report.AppendLine($"Region Volumes: {regions.Length}");
            report.AppendLine($"Stream Cells: {cells.Length}");
            if (haveBounds) report.AppendLine($"Visible world bounds: center={visibleBounds.center} size={visibleBounds.size}");

            if (definition != null)
            {
                definition.Sanitize();
                report.AppendLine();
                report.AppendLine($"Definition: {definition.worldId}");
                report.AppendLine($"Defined regions: {definition.regions.Count}");
                report.AppendLine($"Defined landmarks: {definition.landmarks.Count}");
                report.AppendLine($"Defined corridors: {definition.corridors.Count}");
                foreach (var region in definition.regions)
                {
                    if (region == null) continue;
                    var runtimeMatch = regions.Any(r => r != null && string.Equals(r.RegionId, region.id, StringComparison.OrdinalIgnoreCase));
                    var cellMatch = cells.Any(c => c != null && string.Equals(c.CellId, region.id, StringComparison.OrdinalIgnoreCase));
                    report.AppendLine($"  {region.id,-22} region={(runtimeMatch ? "OK" : "MISSING"),-7} cell={(cellMatch ? "OK" : "MISSING"),-7} terrain={region.terrainRegion}");
                }
            }

            report.AppendLine();
            report.AppendLine($"Major visible objects without nearby collider: {missingPhysical.Count}");
            foreach (var path in missingPhysical.Take(40)) report.AppendLine($"  - {path}");
            if (missingPhysical.Count > 40) report.AppendLine($"  ... +{missingPhysical.Count - 40} more");

            var overlappingTerrains = 0;
            for (var i = 0; i < terrains.Length; i++)
            for (var j = i + 1; j < terrains.Length; j++)
                if (terrains[i].terrainData != null && terrains[j].terrainData != null && TerrainBounds(terrains[i]).Intersects(TerrainBounds(terrains[j])))
                    overlappingTerrains++;
            report.AppendLine($"Terrain overlap pairs: {overlappingTerrains}");

            return report.ToString();
        }

        private static Bounds TerrainBounds(Terrain terrain)
        {
            var size = terrain.terrainData.size;
            return new Bounds(terrain.transform.position + size * 0.5f, size);
        }

        private static string GetHierarchyPath(Transform transform)
        {
            var stack = new Stack<string>();
            var current = transform;
            while (current != null)
            {
                stack.Push(current.name);
                current = current.parent;
            }
            return string.Join("/", stack);
        }
    }
}
