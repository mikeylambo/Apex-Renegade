using System;
using System.IO;
using Apex.AI;
using Apex.Audio;
using Apex.CameraSystem;
using Apex.Combat;
using Apex.Core;
using Apex.Debugging;
using Apex.Encounter;
using Apex.Input;
using Apex.Interaction;
using Apex.Renegade;
using Apex.Save;
using Apex.Settings;
using Apex.Traversal;
using Apex.UI;
using Apex.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Apex.Editor
{
    public static class ApexBatch
    {
        private const string ScenePath = "Assets/ApexPort/Scenes/PortBootstrap.unity";
        private const string RuntimeMaterialDirectory = "Assets/ApexPort/Resources/Apex";
        private const string RuntimeMaterialPath = RuntimeMaterialDirectory + "/RuntimeLit.mat";
        private const string GeneratedDirectory = "Assets/ApexPort/Generated";
        private const string ExpanseTerrainPath = GeneratedDirectory + "/ExpanseTerrain.asset";
        private const string ExpanseLayerPath = GeneratedDirectory + "/ExpanseGround.terrainlayer";
        private const string ExpanseTexturePath = GeneratedDirectory + "/ExpanseGroundTexture.asset";

        public static void ValidateProject()
        {
            var required = new[]
            {
                typeof(ApexRuntime), typeof(ApexSettingsService), typeof(ApexInputService), typeof(ApexHapticsService),
                typeof(ApexAudioService), typeof(ApexPauseService), typeof(ApexSaveService), typeof(HealthComponent),
                typeof(WeaponStateMachine), typeof(ApexWeaponRuntime), typeof(ApexWeaponLoadout), typeof(ApexAimAssistResolver),
                typeof(ApexCameraImpulseState), typeof(ApexAgentMotor), typeof(ApexEscalationMeter), typeof(ApexEncounterController),
                typeof(ApexInteractionScanner), typeof(ApexFirstPersonMotor), typeof(ApexBikeMotor), typeof(ApexRegionVolume),
                typeof(ApexWorldStreamCell), typeof(ApexWorldStreamingController), typeof(ApexPerformanceBudget),
                typeof(ApexRenegadePortBootstrap), typeof(RenegadeArsenalController), typeof(RenegadeEnemyAgent),
                typeof(RenegadeEscalationDirector), typeof(RenegadeResponseDirector), typeof(RenegadeEncounterSpawner),
                typeof(RenegadePickup), typeof(ApexPortCameraV2), typeof(ApexPortHudV2), typeof(ApexPortRuntimeShell),
                typeof(ApexPlayerSmokeProbe)
            };

            foreach (var type in required)
                if (type == null) throw new InvalidOperationException("Apex type validation failed.");

            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null)
                throw new InvalidOperationException($"Generated Apex port scene is missing: {ScenePath}");

            var runtimeMaterial = AssetDatabase.LoadAssetAtPath<Material>(RuntimeMaterialPath);
            if (runtimeMaterial == null || runtimeMaterial.shader == null)
                throw new InvalidOperationException($"Apex runtime material resource is missing or invalid: {RuntimeMaterialPath}");

            var terrain = AssetDatabase.LoadAssetAtPath<TerrainData>(ExpanseTerrainPath);
            if (terrain == null || terrain.heightmapResolution < 129)
                throw new InvalidOperationException($"Generated Expanse TerrainData is missing or invalid: {ExpanseTerrainPath}");

            Debug.Log($"[Apex Batch] Sprint validation passed. Unity {Application.unityVersion}. Modules: {required.Length}. Runtime shader: {runtimeMaterial.shader.name}. Terrain: {terrain.heightmapResolution}².");
        }

        [MenuItem("Apex/Port/Create Bootstrap Scene")]
        public static void CreatePortScene()
        {
            EnsureRuntimeMaterialResource();
            var terrainData = EnsureExpanseTerrainAsset();
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath) ?? "Assets/ApexPort/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var marker = new GameObject("Apex Port Scene // generated; runtime bootstrap builds systems/world detail");
            marker.transform.position = Vector3.zero;

            var terrainObject = Terrain.CreateTerrainGameObject(terrainData);
            terrainObject.name = "Expanse Terrain // Generated Physical Geography";
            terrainObject.transform.position = new Vector3(-900f, 0f, -2700f);
            var terrain = terrainObject.GetComponent<Terrain>();
            terrain.drawInstanced = true;
            terrain.heightmapPixelError = 8f;
            terrain.basemapDistance = 900f;
            terrain.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            var collider = terrainObject.GetComponent<TerrainCollider>();
            if (collider != null) collider.terrainData = terrainData;

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"[Apex Batch] Created {ScenePath} with physical Expanse terrain and installed it as build scene 0.");
        }

        private static void EnsureRuntimeMaterialResource()
        {
            Directory.CreateDirectory(RuntimeMaterialDirectory);
            var shader = Shader.Find("Standard") ?? Shader.Find("Unlit/Color");
            if (shader == null)
                throw new InvalidOperationException("Neither Standard nor Unlit/Color shader is available in the Unity Editor.");

            var material = AssetDatabase.LoadAssetAtPath<Material>(RuntimeMaterialPath);
            if (material == null)
            {
                material = new Material(shader) { name = "Apex Runtime Lit" };
                AssetDatabase.CreateAsset(material, RuntimeMaterialPath);
            }
            else material.shader = shader;

            material.color = Color.white;
            if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", 0.25f);
            if (material.HasProperty("_Glossiness")) material.SetFloat("_Glossiness", 0.40f);
            if (material.HasProperty("_EmissionColor"))
            {
                material.EnableKeyword("_EMISSION");
                material.SetColor("_EmissionColor", Color.black);
            }
            material.enableInstancing = true;
            EditorUtility.SetDirty(material);
            AssetDatabase.SaveAssets();
            AssetDatabase.ImportAsset(RuntimeMaterialPath, ImportAssetOptions.ForceUpdate);
        }

        private static TerrainData EnsureExpanseTerrainAsset()
        {
            Directory.CreateDirectory(GeneratedDirectory);
            const int resolution = 257;
            var terrainData = AssetDatabase.LoadAssetAtPath<TerrainData>(ExpanseTerrainPath);
            if (terrainData == null)
            {
                terrainData = new TerrainData { name = "Expanse Terrain" };
                AssetDatabase.CreateAsset(terrainData, ExpanseTerrainPath);
            }
            terrainData.heightmapResolution = resolution;
            terrainData.size = new Vector3(1800f, 160f, 2200f);

            var heights = new float[resolution, resolution];
            for (var z = 0; z < resolution; z++)
            {
                var zn = z / (float)(resolution - 1);
                var worldZ = Mathf.Lerp(-2700f, -500f, zn);
                for (var x = 0; x < resolution; x++)
                {
                    var xn = x / (float)(resolution - 1);
                    var worldX = Mathf.Lerp(-900f, 900f, xn);
                    var roadDistance = Mathf.Abs(worldX);
                    var outsideRoad = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(42f, 185f, roadDistance));
                    var edge = Mathf.Pow(Mathf.Clamp01(Mathf.InverseLerp(80f, 900f, roadDistance)), 1.35f);
                    var macro = (Mathf.Sin(worldX * 0.009f + worldZ * 0.0022f) + Mathf.Sin(worldZ * 0.0065f - worldX * 0.003f)) * 0.022f;
                    var ridge = Mathf.Pow(Mathf.Abs(Mathf.Sin(worldX * 0.0042f + worldZ * 0.0017f)), 3f) * 0.11f;
                    var basin = Mathf.Sin((zn - 0.5f) * Mathf.PI) * 0.018f;
                    var normalizedHeight = outsideRoad * Mathf.Max(0f, edge * 0.34f + macro + ridge + basin);
                    if (roadDistance <= 42f) normalizedHeight = 0f;
                    heights[z, x] = Mathf.Clamp01(normalizedHeight);
                }
            }
            terrainData.SetHeights(0, 0, heights);

            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(ExpanseTexturePath);
            if (texture == null)
            {
                texture = new Texture2D(16, 16, TextureFormat.RGBA32, true) { name = "Expanse Ground Texture", wrapMode = TextureWrapMode.Repeat };
                var pixels = new Color[16 * 16];
                for (var y = 0; y < 16; y++)
                    for (var x = 0; x < 16; x++)
                    {
                        var n = Mathf.PerlinNoise(x * 0.31f + 1.7f, y * 0.29f + 3.1f);
                        pixels[y * 16 + x] = Color.Lerp(new Color(0.13f, 0.15f, 0.145f), new Color(0.23f, 0.235f, 0.21f), n);
                    }
                texture.SetPixels(pixels);
                texture.Apply(true, false);
                AssetDatabase.CreateAsset(texture, ExpanseTexturePath);
            }

            var layer = AssetDatabase.LoadAssetAtPath<TerrainLayer>(ExpanseLayerPath);
            if (layer == null)
            {
                layer = new TerrainLayer { name = "Expanse Ground" };
                AssetDatabase.CreateAsset(layer, ExpanseLayerPath);
            }
            layer.diffuseTexture = texture;
            layer.tileSize = new Vector2(26f, 26f);
            layer.tileOffset = Vector2.zero;
            layer.metallic = 0.02f;
            layer.smoothness = 0.12f;
            EditorUtility.SetDirty(layer);
            terrainData.terrainLayers = new[] { layer };
            EditorUtility.SetDirty(terrainData);
            AssetDatabase.SaveAssets();
            return terrainData;
        }

        public static void CreateAndValidate()
        {
            CreatePortScene();
            ValidateProject();
        }

        public static void BuildWindowsDevelopment()
        {
            CreatePortScene();
            ValidateProject();

            PlayerSettings.productName = "Apex Renegade";
            PlayerSettings.companyName = "Mikey Lambo";
            PlayerSettings.bundleVersion = "0.2.0-port";

            var output = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Builds", "Windows", "ApexRenegade.exe"));
            Directory.CreateDirectory(Path.GetDirectoryName(output) ?? "Builds/Windows");
            var result = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = output,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.Development | BuildOptions.AllowDebugging
            });
            if (result.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
                throw new Exception($"Apex Windows development build failed: {result.summary.result}; errors={result.summary.totalErrors}; warnings={result.summary.totalWarnings}");
            Debug.Log($"[Apex Batch] Windows development build ready: {output} ({result.summary.totalSize} bytes).");
        }
    }
}
