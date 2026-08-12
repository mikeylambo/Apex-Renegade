using System.Collections;
using Apex.Core;
using Apex.Input;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-560)]
    public sealed class RenegadeFlightInstaller : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureInstaller()
        {
            if (Object.FindFirstObjectByType<RenegadeFlightInstaller>() != null) return;
            new GameObject("Apex Flight Installer").AddComponent<RenegadeFlightInstaller>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                if (player != null && ApexRuntime.IsInitialized && ApexRuntime.Services.TryGet<ApexInputService>(out var input))
                {
                    var flight = player.GetComponent<ApexFlightController>() ?? player.gameObject.AddComponent<ApexFlightController>();
                    flight.Configure(input);
                    yield break;
                }
                yield return null;
            }
            Debug.LogWarning("[Apex Flight] Could not resolve player/input during bootstrap window.");
        }
    }
}
