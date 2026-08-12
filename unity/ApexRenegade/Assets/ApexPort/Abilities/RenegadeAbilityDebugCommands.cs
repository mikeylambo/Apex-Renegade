using System.Collections;
using System.Collections.Generic;
using Apex.Core;
using Apex.Debugging;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade.Abilities
{
    public sealed class RenegadeAbilityDebugCommands : MonoBehaviour
    {
        private ApexScenarioService _scenarios;
        private RenegadeApexSurge _surge;
        private ApexFlightController _flight;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureCommands()
        {
            if (Object.FindFirstObjectByType<RenegadeAbilityDebugCommands>() != null) return;
            new GameObject("Apex Ability Debug Commands").AddComponent<RenegadeAbilityDebugCommands>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _surge = Object.FindFirstObjectByType<RenegadeApexSurge>();
                _flight = Object.FindFirstObjectByType<ApexFlightController>();
                if (ApexRuntime.IsInitialized && ApexRuntime.Services.TryGet<ApexScenarioService>(out _scenarios) && _surge != null && _flight != null)
                {
                    _scenarios.Register("surge", SurgeCommand);
                    _scenarios.Register("flight", FlightCommand);
                    yield break;
                }
                yield return null;
            }
        }

        private ApexScenarioResult SurgeCommand(IReadOnlyList<string> args)
        {
            var command = args.Count > 0 ? args[0].ToLowerInvariant() : "full";
            if (command == "full")
            {
                _surge.Charge.Set(1f);
                return ApexScenarioResult.Ok("Apex Charge filled. Press Surge input on foot to activate.");
            }
            if (command == "empty" || command == "reset")
            {
                _surge.Charge.Set(0f);
                _surge.Surge.Reset();
                return ApexScenarioResult.Ok("Apex Charge / Surge reset.");
            }
            return ApexScenarioResult.Fail("Usage: surge full|reset");
        }

        private ApexScenarioResult FlightCommand(IReadOnlyList<string> args)
        {
            var command = args.Count > 0 ? args[0].ToLowerInvariant() : "toggle";
            var enabled = command switch
            {
                "on" => true,
                "off" => false,
                "toggle" => !_flight.IsFlying,
                _ => _flight.IsFlying
            };
            if (command != "on" && command != "off" && command != "toggle")
                return ApexScenarioResult.Fail("Usage: flight on|off|toggle");
            _flight.SetFlight(enabled);
            return ApexScenarioResult.Ok($"Flight {(enabled ? "enabled" : "disabled")}.");
        }

        private void OnDestroy()
        {
            if (_scenarios == null) return;
            _scenarios.Unregister("surge");
            _scenarios.Unregister("flight");
        }
    }
}
