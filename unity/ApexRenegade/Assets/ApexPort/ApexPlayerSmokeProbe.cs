using System;
using System.Collections;
using Apex.Audio;
using Apex.Core;
using Apex.Debugging;
using Apex.Input;
using Apex.Interaction;
using Apex.Traversal;
using Apex.World;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class ApexPlayerSmokeProbe : MonoBehaviour
    {
        private const string SmokeArg = "-apexPlayerSmoke";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void InstallWhenRequested()
        {
            var args = Environment.GetCommandLineArgs();
            if (!Array.Exists(args, arg => string.Equals(arg, SmokeArg, StringComparison.OrdinalIgnoreCase))) return;
            new GameObject("Apex Player Smoke Probe").AddComponent<ApexPlayerSmokeProbe>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 16; i++) yield return null;

            Exception failure = null;
            Material runtimeMaterial = null;
            RenegadeArsenalController arsenal = null;
            try
            {
                runtimeMaterial = Resources.Load<Material>("Apex/RuntimeLit");
                Require(runtimeMaterial != null, "Runtime material resource did not load.");
                Require(runtimeMaterial.shader != null, "Runtime material shader is null in standalone player.");

                Require(UnityEngine.Object.FindFirstObjectByType<ApexRenegadePortBootstrap>() != null, "Apex runtime bootstrap is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexFirstPersonMotor>() != null, "Renegade player motor is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexBikeMotor>() != null, "Renegade bike is missing.");
                arsenal = UnityEngine.Object.FindFirstObjectByType<RenegadeArsenalController>();
                Require(arsenal != null, "Renegade arsenal is missing.");
                Require(arsenal.Loadout != null && arsenal.Loadout.Count >= 2, "Corona + Maw loadout did not initialize.");
                Require(arsenal.Loadout.Find("corona-blaster") != null, "Corona runtime missing.");
                Require(arsenal.Loadout.Find("maw") != null, "Maw runtime missing.");

                Require(UnityEngine.Object.FindFirstObjectByType<ApexPortCameraV2>() != null, "Cinematic camera V2 is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexPortHudV2>() != null, "HUD V2 is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexInteractionScanner>() != null, "Interaction scanner is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<RenegadeEscalationDirector>() != null, "Pressure/Refusal director is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<RenegadeResponseDirector>() != null, "Pressure response director is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<RenegadeEncounterSpawner>() != null, "Encounter adapter is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<RenegadeEnemyAgent>() != null, "Apex AI enemy agent did not spawn.");
                Require(UnityEngine.Object.FindObjectsByType<RenegadePickup>(FindObjectsSortMode.None).Length >= 4, "Pickup layer did not initialize.");

                var terrain = UnityEngine.Object.FindFirstObjectByType<Terrain>();
                Require(terrain != null && terrain.terrainData != null, "Physical Expanse terrain is missing.");
                Require(terrain.GetComponent<TerrainCollider>() != null, "Expanse TerrainCollider is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexWorldStreamingController>() != null, "World streaming controller is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexPerformanceBudget>() != null, "Adaptive performance budget is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexHapticsService>() != null, "Haptics service is missing.");

                Require(UnityEngine.Object.FindFirstObjectByType<Camera>() != null, "Runtime camera is missing.");
                Require(GameObject.Find("Apex Port World") != null, "Apex Port World is missing.");
                Require(ApexRuntime.Services.TryGet<ApexAudioService>(out var audio) && audio.HasCue("weapon.maw"), "Apex audio service/cue bank is missing.");
            }
            catch (Exception ex)
            {
                failure = ex;
            }

            if (failure == null)
            {
                Debug.Log($"[Apex Player Smoke] PASS // shader={runtimeMaterial.shader.name} // weapons={arsenal.Loadout.Count} // terrain=physical // build={Application.version}");
                yield return null;
                Application.Quit(0);
            }
            else
            {
                Debug.LogError($"[Apex Player Smoke] FAIL // {failure}");
                yield return null;
                Application.Quit(2);
            }
        }

        private static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}
