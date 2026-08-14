using System;
using System.Collections;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade.Abilities
{
    public sealed class RenegadeAbilitySmokeProbe : MonoBehaviour
    {
        private const string SmokeArg = "-apexPlayerSmoke";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void InstallWhenRequested()
        {
            var args = Environment.GetCommandLineArgs();
            if (!Array.Exists(args, arg => string.Equals(arg, SmokeArg, StringComparison.OrdinalIgnoreCase))) return;
            new GameObject("Apex Ability Smoke Probe").AddComponent<RenegadeAbilitySmokeProbe>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            ApexFlightController flight = null;
            RenegadeApexSurge surge = null;
            for (var i = 0; i < 150; i++)
            {
                flight = Object.FindFirstObjectByType<ApexFlightController>();
                surge = Object.FindFirstObjectByType<RenegadeApexSurge>();
                if (flight != null && surge != null) break;
                yield return null;
            }

            if (flight == null || surge == null || surge.Charge == null || surge.Surge == null)
            {
                Debug.LogError($"[Apex Ability Smoke] FAIL // flight={flight != null} surge={surge != null}");
                yield break;
            }

            Debug.Log("[Apex Ability Smoke] PASS // flight=ready // apex-surge=ready");
        }
    }
}
