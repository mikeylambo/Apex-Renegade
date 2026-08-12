using System;
using System.IO;
using Apex.Combat;
using Apex.Core;
using Apex.Input;
using Apex.Renegade;
using Apex.Save;
using Apex.Settings;
using Apex.Traversal;
using Apex.UI;
using Apex.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Apex.Editor
{
    public static class ApexBatch
    {
        private const string ScenePath = "Assets/ApexPort/Scenes/PortBootstrap.unity";

        public static void ValidateProject()
        {
            var required = new[]
            {
                typeof(ApexRuntime),
                typeof(ApexSettingsService),
                typeof(ApexInputService),
                typeof(ApexPauseService),
                typeof(ApexSaveService),
                typeof(HealthComponent),
                typeof(WeaponStateMachine),
                typeof(ApexWeaponRuntime),
                typeof(ApexAimAssistResolver),
                typeof(ApexFirstPersonMotor),
                typeof(ApexBikeMotor),
                typeof(ApexRegionVolume),
                typeof(ApexRenegadePortBootstrap),
                typeof(RenegadeWeaponController),
                typeof(ApexPortRuntimeShell)
            };

            foreach (var type in required)
                if (type == null) throw new InvalidOperationException("Apex type validation failed.");

            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null)
                throw new InvalidOperationException($"Generated Apex port scene is missing: {ScenePath}");

            Debug.Log($"[Apex Batch] Foundation validation passed. Unity {Application.unityVersion}. Modules: {required.Length}.");
        }

        [MenuItem("Apex/Port/Create Bootstrap Scene")]
        public static void CreatePortScene()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath) ?? "Assets/ApexPort/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var marker = new GameObject("Apex Port Scene // generated; runtime bootstrap builds the world");
            marker.transform.position = Vector3.zero;
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"[Apex Batch] Created {ScenePath} and installed it as build scene 0.");
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
            PlayerSettings.bundleVersion = "0.1.0-port";

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
