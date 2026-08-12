using System;
using System.Collections;
using Apex.Traversal;
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

            // Give all AfterSceneLoad runtime bootstrap hooks and one normal frame time to finish.
            for (var i = 0; i < 4; i++) yield return null;

            Exception failure = null;
            Material runtimeMaterial = null;
            try
            {
                runtimeMaterial = Resources.Load<Material>("Apex/RuntimeLit");
                Require(runtimeMaterial != null, "Runtime material resource did not load.");
                Require(runtimeMaterial.shader != null, "Runtime material shader is null in standalone player.");

                Require(UnityEngine.Object.FindFirstObjectByType<ApexRenegadePortBootstrap>() != null, "Apex runtime bootstrap is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexFirstPersonMotor>() != null, "Renegade player motor is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<ApexBikeMotor>() != null, "Renegade bike is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<RenegadeWeaponController>() != null, "Corona weapon controller is missing.");
                Require(UnityEngine.Object.FindFirstObjectByType<Camera>() != null, "Runtime camera is missing.");
                Require(GameObject.Find("Apex Port World") != null, "Apex Port World is missing.");
            }
            catch (Exception ex)
            {
                failure = ex;
            }

            if (failure == null)
            {
                Debug.Log($"[Apex Player Smoke] PASS // shader={runtimeMaterial.shader.name}");
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
