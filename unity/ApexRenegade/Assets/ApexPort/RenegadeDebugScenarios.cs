using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using Apex.Combat;
using Apex.Core;
using Apex.Debugging;
using Apex.Input;
using Apex.Save;
using Apex.Traversal;
using UnityEngine;
using UnityEngine.InputSystem;
using Object = UnityEngine.Object;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-590)]
    public sealed class RenegadeDebugScenarios : MonoBehaviour
    {
        private ApexScenarioService _scenarios;
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private RenegadeArsenalController _arsenal;
        private RenegadeEscalationDirector _escalation;
        private RenegadeEncounterSpawner _spawner;
        private ApexSaveService _save;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureInstaller()
        {
            if (Object.FindFirstObjectByType<RenegadeDebugScenarios>() != null) return;
            new GameObject("Apex Renegade Debug Scenarios").AddComponent<RenegadeDebugScenarios>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                _arsenal = Object.FindFirstObjectByType<RenegadeArsenalController>();
                _escalation = Object.FindFirstObjectByType<RenegadeEscalationDirector>();
                _spawner = Object.FindFirstObjectByType<RenegadeEncounterSpawner>();
                if (ApexRuntime.IsInitialized &&
                    ApexRuntime.Services.TryGet<ApexScenarioService>(out _scenarios) &&
                    ApexRuntime.Services.TryGet<ApexSaveService>(out _save) &&
                    _player != null && _bike != null && _arsenal?.Loadout != null && _escalation?.Pressure != null && _spawner != null)
                {
                    RegisterCommands();
                    if (Debug.isDebugBuild && Object.FindFirstObjectByType<RenegadeDebugConsole>() == null)
                        gameObject.AddComponent<RenegadeDebugConsole>().Configure(_scenarios);
                    yield break;
                }
                yield return null;
            }
            Debug.LogWarning("[Apex Scenario] Renegade command installer could not resolve dependencies.");
        }

        private void RegisterCommands()
        {
            _scenarios.Register("goto", Goto);
            _scenarios.Register("spawn", Spawn);
            _scenarios.Register("stress", Stress);
            _scenarios.Register("clear", ClearEnemies);
            _scenarios.Register("pressure", Pressure);
            _scenarios.Register("refusal", Refusal);
            _scenarios.Register("refill", Refill);
            _scenarios.Register("bike", Bike);
            _scenarios.Register("checkpoint", Checkpoint);
            _scenarios.Register("scarwar", ScarWar);
            _scenarios.Register("expanse_ride", ExpanseRide);
        }

        private ApexScenarioResult Goto(IReadOnlyList<string> args)
        {
            if (args.Count < 1) return ApexScenarioResult.Fail("Usage: goto scar|expanse|vertical");
            var key = args[0].ToLowerInvariant();
            var position = key switch
            {
                "scar" => new Vector3(0f, 2.4f, 500f),
                "expanse" => new Vector3(0f, 2.4f, -1450f),
                "vertical" => new Vector3(0f, 2.4f, -3100f),
                _ => new Vector3(float.NaN, 0f, 0f)
            };
            if (float.IsNaN(position.x)) return ApexScenarioResult.Fail("Unknown region. Use scar, expanse, or vertical.");
            TeleportActor(position, Quaternion.identity);
            return ApexScenarioResult.Ok($"Teleported to {key}.");
        }

        private ApexScenarioResult Spawn(IReadOnlyList<string> args)
        {
            if (args.Count < 1) return ApexScenarioResult.Fail("Usage: spawn hollow|enforcer [count]");
            var archetype = args[0].ToLowerInvariant();
            if (archetype != "hollow" && archetype != "enforcer") return ApexScenarioResult.Fail("Archetype must be hollow or enforcer.");
            var count = args.Count > 1 && int.TryParse(args[1], out var parsed) ? Mathf.Clamp(parsed, 1, 120) : 1;
            var origin = CurrentPosition() + CurrentForward() * 32f;
            for (var i = 0; i < count; i++) _spawner.Spawn(archetype, origin);
            return ApexScenarioResult.Ok($"Spawned {count} {archetype}(s).");
        }

        private ApexScenarioResult Stress(IReadOnlyList<string> args)
        {
            var count = args.Count > 0 && int.TryParse(args[0], out var parsed) ? Mathf.Clamp(parsed, 10, 180) : 60;
            var origin = CurrentPosition() + CurrentForward() * 38f;
            for (var i = 0; i < count; i++)
                _spawner.Spawn(i % 7 == 0 ? "enforcer" : "hollow", origin + new Vector3((i % 9 - 4) * 4f, 0f, -(i / 9) * 6f));
            _escalation.Pressure.Set(Mathf.Max(_escalation.Pressure.Value, 0.88f));
            return ApexScenarioResult.Ok($"Stress scenario active: {count} agents requested.");
        }

        private ApexScenarioResult ClearEnemies(IReadOnlyList<string> _)
        {
            var enemies = Object.FindObjectsByType<RenegadeEnemyAgent>(FindObjectsSortMode.None);
            var killed = 0;
            for (var i = 0; i < enemies.Length; i++)
            {
                var health = enemies[i]?.Health;
                if (health == null || !health.IsAlive) continue;
                health.ApplyDamage(new DamagePayload(99999f, enemies[i].transform.position, Vector3.up, DamageKind.Environmental, gameObject));
                killed++;
            }
            return ApexScenarioResult.Ok($"Cleared {killed} live enemy agents.");
        }

        private ApexScenarioResult Pressure(IReadOnlyList<string> args)
        {
            if (!TryUnitFloat(args, out var value)) return ApexScenarioResult.Fail("Usage: pressure 0..1");
            _escalation.Pressure.Set(value);
            return ApexScenarioResult.Ok($"Pressure={_escalation.Pressure.Value:0.00} // {_escalation.PressureLabel}");
        }

        private ApexScenarioResult Refusal(IReadOnlyList<string> args)
        {
            if (!TryUnitFloat(args, out var value)) return ApexScenarioResult.Fail("Usage: refusal 0..1");
            _escalation.Refusal.Set(value);
            return ApexScenarioResult.Ok($"Refusal={_escalation.Refusal.Value:0.00} // {_escalation.RefusalLabel}");
        }

        private ApexScenarioResult Refill(IReadOnlyList<string> _)
        {
            var health = _player.GetComponent<HealthComponent>();
            health?.ResetVitals();
            for (var i = 0; i < _arsenal.Loadout.Weapons.Count; i++)
            {
                var weapon = _arsenal.Loadout.Weapons[i];
                weapon.RestoreAmmo(weapon.Definition.magazineSize, Mathf.Max(weapon.Reserve, weapon.Definition.startingReserve));
            }
            return ApexScenarioResult.Ok("Vitals and ammunition restored.");
        }

        private ApexScenarioResult Bike(IReadOnlyList<string> args)
        {
            var command = args.Count > 0 ? args[0].ToLowerInvariant() : "recall";
            if (command == "recall")
            {
                if (_bike.IsMounted) return ApexScenarioResult.Fail("Bike is already mounted.");
                _bike.Recall();
                return ApexScenarioResult.Ok("Bike recall requested.");
            }
            if (command == "summon")
            {
                if (_bike.IsMounted) _bike.Dismount();
                var body = _bike.GetComponent<Rigidbody>();
                if (body != null)
                {
                    body.isKinematic = false;
                    body.velocity = Vector3.zero;
                    body.angularVelocity = Vector3.zero;
                }
                _bike.transform.SetPositionAndRotation(_player.transform.position + _player.transform.right * 2.5f, _player.transform.rotation);
                return ApexScenarioResult.Ok("Bike placed beside Renegade.");
            }
            return ApexScenarioResult.Fail("Usage: bike recall|summon");
        }

        private ApexScenarioResult Checkpoint(IReadOnlyList<string> _)
        {
            var position = CurrentPosition();
            var rotation = _bike.IsMounted ? _bike.transform.rotation : _player.transform.rotation;
            _save.SetCheckpoint("debug-checkpoint", "Debug", position, rotation);
            return ApexScenarioResult.Ok("Debug checkpoint saved.");
        }

        private ApexScenarioResult ScarWar(IReadOnlyList<string> _)
        {
            TeleportActor(new Vector3(0f, 2.4f, 360f), Quaternion.identity);
            _escalation.Pressure.Set(0.74f);
            _escalation.Refusal.Set(Mathf.Max(_escalation.Refusal.Value, 0.30f));
            for (var i = 0; i < 18; i++) _spawner.Spawn(i % 6 == 0 ? "enforcer" : "hollow", new Vector3(0f, 0f, 290f));
            return ApexScenarioResult.Ok("Scar War scenario armed.");
        }

        private ApexScenarioResult ExpanseRide(IReadOnlyList<string> _)
        {
            if (_bike.IsMounted) _bike.Dismount();
            _player.Teleport(new Vector3(0f, 2.4f, -980f), Quaternion.identity);
            var body = _bike.GetComponent<Rigidbody>();
            if (body != null)
            {
                body.isKinematic = false;
                body.velocity = Vector3.zero;
                body.angularVelocity = Vector3.zero;
            }
            _bike.transform.SetPositionAndRotation(new Vector3(2.6f, 0.9f, -982f), Quaternion.identity);
            return ApexScenarioResult.Ok("Expanse ride start staged; mount bike beside player.");
        }

        private void TeleportActor(Vector3 position, Quaternion rotation)
        {
            if (_bike.IsMounted)
            {
                var body = _bike.GetComponent<Rigidbody>();
                if (body != null)
                {
                    body.velocity = Vector3.zero;
                    body.angularVelocity = Vector3.zero;
                }
                _bike.transform.SetPositionAndRotation(position, rotation);
            }
            else _player.Teleport(position, rotation);
        }

        private Vector3 CurrentPosition() => _bike.IsMounted ? _bike.transform.position : _player.transform.position;
        private Vector3 CurrentForward() => _bike.IsMounted ? _bike.transform.forward : _player.transform.forward;

        private static bool TryUnitFloat(IReadOnlyList<string> args, out float value)
        {
            value = 0f;
            if (args.Count < 1 || !float.TryParse(args[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)) return false;
            value = Mathf.Clamp01(parsed);
            return true;
        }
    }

    public sealed class RenegadeDebugConsole : MonoBehaviour
    {
        private ApexScenarioService _scenarios;
        private string _command = string.Empty;
        private bool _open;
        private float _previousTimeScale = 1f;
        private Vector2 _scroll;
        private GUIStyle _console;
        private GUIStyle _header;

        public void Configure(ApexScenarioService scenarios) => _scenarios = scenarios;

        private void Update()
        {
            if (!Debug.isDebugBuild) return;
            if (Keyboard.current?.f9Key.wasPressedThisFrame == true) SetOpen(!_open);
        }

        private void SetOpen(bool open)
        {
            if (_open == open) return;
            _open = open;
            if (_open)
            {
                _previousTimeScale = Time.timeScale;
                Time.timeScale = 0f;
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
            else
            {
                Time.timeScale = _previousTimeScale;
                if (_previousTimeScale > 0f)
                {
                    Cursor.lockState = CursorLockMode.Locked;
                    Cursor.visible = false;
                }
            }
        }

        private void OnGUI()
        {
            if (!_open || _scenarios == null) return;
            EnsureStyles();
            var panel = new Rect(24f, 24f, Mathf.Min(820f, Screen.width - 48f), Mathf.Min(580f, Screen.height - 48f));
            GUI.color = new Color(0.005f, 0.008f, 0.014f, 0.95f);
            GUI.DrawTexture(panel, Texture2D.whiteTexture);
            GUI.color = Color.white;
            GUI.Label(new Rect(panel.x + 18f, panel.y + 14f, panel.width - 36f, 30f), "APEX // SCENARIO CONSOLE   [F9]", _header);

            var historyRect = new Rect(panel.x + 18f, panel.y + 52f, panel.width - 36f, panel.height - 116f);
            var entries = _scenarios.History;
            var contentHeight = Mathf.Max(historyRect.height, entries.Count * 48f + 12f);
            _scroll = GUI.BeginScrollView(historyRect, _scroll, new Rect(0f, 0f, historyRect.width - 20f, contentHeight));
            var y = 6f;
            for (var i = 0; i < entries.Count; i++)
            {
                GUI.Label(new Rect(6f, y, historyRect.width - 44f, 44f), entries[i], _console);
                y += 48f;
            }
            GUI.EndScrollView();

            GUI.SetNextControlName("ApexScenarioInput");
            _command = GUI.TextField(new Rect(panel.x + 18f, panel.yMax - 52f, panel.width - 130f, 32f), _command, _console);
            if (GUI.Button(new Rect(panel.xMax - 102f, panel.yMax - 52f, 84f, 32f), "RUN")) Run();
            GUI.FocusControl("ApexScenarioInput");

            var e = Event.current;
            if (e.type == EventType.KeyDown && (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter))
            {
                Run();
                e.Use();
            }
        }

        private void Run()
        {
            var line = _command.Trim();
            if (line.Length == 0) return;
            _scenarios.Execute(line);
            _command = string.Empty;
            _scroll.y = float.MaxValue;
        }

        private void EnsureStyles()
        {
            if (_console != null) return;
            _console = new GUIStyle(GUI.skin.label) { fontSize = 14, wordWrap = true };
            _console.normal.textColor = new Color(0.76f, 0.86f, 0.98f);
            _header = new GUIStyle(_console) { fontSize = 18, fontStyle = FontStyle.Bold };
            _header.normal.textColor = new Color(0.72f, 0.56f, 1f);
        }

        private void OnDestroy()
        {
            if (_open) SetOpen(false);
        }
    }
}
