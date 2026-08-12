using System;
using System.IO;
using Apex.World;
using UnityEditor;
using UnityEngine;

namespace Apex.EditorTools
{
    public static class ApexTerrainCorridorBaker
    {
        private const string GeneratedRoot = "Assets/ApexGenerated/Terrain";

        public static Terrain Bake(
            ApexWorldSpineDefinition world,
            ApexWorldRegionDefinition region,
            ApexTravelCorridorDefinition corridor,
            int heightmapResolution = 257)
        {
            if (world == null) throw new ArgumentNullException(nameof(world));
            if (region == null) throw new ArgumentNullException(nameof(region));
            region.Sanitize();
            heightmapResolution = Mathf.ClosestPowerOfTwo(Mathf.Clamp(heightmapResolution - 1, 128, 1024)) + 1;

            Directory.CreateDirectory(GeneratedRoot);
            var safeId = SanitizeFileName(region.id);
            var dataPath = $"{GeneratedRoot}/{safeId}-Terrain.asset";
            var layerPath = $"{GeneratedRoot}/{safeId}-Ground.terrainlayer";
            var texturePath = $"{GeneratedRoot}/{safeId}-GroundTexture.asset";

            var terrainData = AssetDatabase.LoadAssetAtPath<TerrainData>(dataPath);
            if (terrainData == null)
            {
                terrainData = new TerrainData { name = $"{region.displayName} Terrain" };
                AssetDatabase.CreateAsset(terrainData, dataPath);
            }

            var size = region.bounds.size;
            var terrainHeight = Mathf.Max(80f, Mathf.Min(420f, size.y));
            terrainData.heightmapResolution = heightmapResolution;
            terrainData.size = new Vector3(size.x, terrainHeight, size.z);

            var heights = new float[heightmapResolution, heightmapResolution];
            var origin = region.bounds.min;
            for (var z = 0; z < heightmapResolution; z++)
            {
                var zn = z / (float)(heightmapResolution - 1);
                for (var x = 0; x < heightmapResolution; x++)
                {
                    var xn = x / (float)(heightmapResolution - 1);
                    var worldPosition = new Vector3(origin.x + xn * size.x, region.bounds.min.y, origin.z + zn * size.z);
                    var corridorInfluence = corridor != null ? CorridorDistance01(worldPosition, corridor) : 1f;
                    var macro = Fbm(worldPosition.x * 0.0026f, worldPosition.z * 0.0026f, 4);
                    var ridge = 1f - Mathf.Abs(Fbm(worldPosition.x * 0.0042f + 12f, worldPosition.z * 0.0038f - 7f, 3) * 2f - 1f);
                    ridge = Mathf.Pow(Mathf.Clamp01(ridge), 2.7f);
                    var basin = Mathf.Sin((zn - 0.5f) * Mathf.PI) * 0.03f;
                    var raw = macro * 0.22f + ridge * 0.18f + basin;
                    var shaped = Mathf.Clamp01(raw * corridorInfluence);
                    if (corridor != null && corridorInfluence <= 0.001f) shaped = 0f;
                    heights[z, x] = shaped;
                }
            }
            terrainData.SetHeights(0, 0, heights);

            var texture = EnsureGroundTexture(texturePath, region.id);
            var layer = AssetDatabase.LoadAssetAtPath<TerrainLayer>(layerPath);
            if (layer == null)
            {
                layer = new TerrainLayer { name = $"{region.displayName} Ground" };
                AssetDatabase.CreateAsset(layer, layerPath);
            }
            layer.diffuseTexture = texture;
            layer.tileSize = new Vector2(24f, 24f);
            layer.metallic = 0.01f;
            layer.smoothness = 0.10f;
            EditorUtility.SetDirty(layer);
            terrainData.terrainLayers = new[] { layer };
            EditorUtility.SetDirty(terrainData);
            AssetDatabase.SaveAssets();

            var existing = GameObject.Find($"Terrain // {region.displayName}");
            GameObject terrainObject;
            if (existing != null)
            {
                terrainObject = existing;
                Undo.RecordObject(terrainObject.transform, "Update Apex Terrain");
                var terrain = terrainObject.GetComponent<Terrain>() ?? Undo.AddComponent<Terrain>(terrainObject);
                var collider = terrainObject.GetComponent<TerrainCollider>() ?? Undo.AddComponent<TerrainCollider>(terrainObject);
                terrain.terrainData = terrainData;
                collider.terrainData = terrainData;
            }
            else
            {
                terrainObject = Terrain.CreateTerrainGameObject(terrainData);
                terrainObject.name = $"Terrain // {region.displayName}";
                Undo.RegisterCreatedObjectUndo(terrainObject, "Create Apex Terrain");
            }

            terrainObject.transform.position = new Vector3(region.bounds.min.x, region.bounds.min.y, region.bounds.min.z);
            var terrainComponent = terrainObject.GetComponent<Terrain>();
            terrainComponent.drawInstanced = true;
            terrainComponent.heightmapPixelError = 7f;
            terrainComponent.basemapDistance = 1000f;
            terrainComponent.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            Selection.activeGameObject = terrainObject;
            return terrainComponent;
        }

        private static float CorridorDistance01(Vector3 point, ApexTravelCorridorDefinition corridor)
        {
            var start = new Vector2(corridor.start.x, corridor.start.z);
            var end = new Vector2(corridor.end.x, corridor.end.z);
            var p = new Vector2(point.x, point.z);
            var line = end - start;
            var denominator = Mathf.Max(0.0001f, line.sqrMagnitude);
            var t = Mathf.Clamp01(Vector2.Dot(p - start, line) / denominator);
            var nearest = start + line * t;
            var distance = Vector2.Distance(p, nearest);
            var flat = Mathf.Max(1f, corridor.width * 0.5f + corridor.flatShoulder);
            var transition = Mathf.Max(flat + 1f, flat + corridor.transitionWidth);
            return Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(flat, transition, distance));
        }

        private static float Fbm(float x, float y, int octaves)
        {
            var value = 0f;
            var amplitude = 0.5f;
            var frequency = 1f;
            var total = 0f;
            for (var i = 0; i < octaves; i++)
            {
                value += Mathf.PerlinNoise(x * frequency, y * frequency) * amplitude;
                total += amplitude;
                amplitude *= 0.5f;
                frequency *= 2.03f;
            }
            return total > 0f ? value / total : 0f;
        }

        private static Texture2D EnsureGroundTexture(string path, string seed)
        {
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (texture != null) return texture;

            texture = new Texture2D(32, 32, TextureFormat.RGBA32, true)
            {
                name = $"{seed} Generated Ground",
                wrapMode = TextureWrapMode.Repeat
            };
            var hash = Mathf.Abs(seed?.GetHashCode() ?? 1);
            var offsetX = (hash % 97) * 0.17f;
            var offsetY = (hash % 53) * 0.23f;
            var pixels = new Color[32 * 32];
            for (var y = 0; y < 32; y++)
            for (var x = 0; x < 32; x++)
            {
                var n = Mathf.PerlinNoise(x * 0.19f + offsetX, y * 0.19f + offsetY);
                var fine = Mathf.PerlinNoise(x * 0.61f + 4.7f, y * 0.57f + 8.3f);
                var tone = Mathf.Clamp01(n * 0.72f + fine * 0.28f);
                pixels[y * 32 + x] = Color.Lerp(new Color(0.115f, 0.125f, 0.12f), new Color(0.26f, 0.255f, 0.22f), tone);
            }
            texture.SetPixels(pixels);
            texture.Apply(true, false);
            AssetDatabase.CreateAsset(texture, path);
            return texture;
        }

        private static string SanitizeFileName(string value)
        {
            var name = string.IsNullOrWhiteSpace(value) ? "region" : value.Trim();
            foreach (var invalid in Path.GetInvalidFileNameChars()) name = name.Replace(invalid, '-');
            return name.Replace(' ', '-').ToLowerInvariant();
        }
    }
}
