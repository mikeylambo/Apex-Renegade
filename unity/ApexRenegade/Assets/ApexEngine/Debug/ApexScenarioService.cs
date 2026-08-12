using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Apex.Core;
using UnityEngine;

namespace Apex.Debugging
{
    public readonly struct ApexScenarioResult
    {
        public readonly bool Success;
        public readonly string Message;

        public ApexScenarioResult(bool success, string message)
        {
            Success = success;
            Message = message ?? string.Empty;
        }

        public static ApexScenarioResult Ok(string message = "OK") => new(true, message);
        public static ApexScenarioResult Fail(string message) => new(false, message);
    }

    public delegate ApexScenarioResult ApexScenarioCommand(IReadOnlyList<string> args);

    [DefaultExecutionOrder(-805)]
    public sealed class ApexScenarioService : MonoBehaviour, IApexService
    {
        private readonly Dictionary<string, ApexScenarioCommand> _commands = new(StringComparer.OrdinalIgnoreCase);
        private readonly List<string> _history = new();
        private bool _registered;

        public IReadOnlyList<string> History => _history;
        public IEnumerable<string> CommandNames => _commands.Keys;
        public event Action<string, ApexScenarioResult> Executed;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureService()
        {
            if (UnityEngine.Object.FindFirstObjectByType<ApexScenarioService>() != null) return;
            new GameObject("Apex Scenario Service").AddComponent<ApexScenarioService>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 120; i++)
            {
                if (ApexRuntime.IsInitialized)
                {
                    Initialize(ApexRuntime.Services);
                    yield break;
                }
                yield return null;
            }
        }

        public void Initialize(ApexServices services)
        {
            if (_registered) return;
            services.Register(this);
            _registered = true;
            Register("help", _ => ApexScenarioResult.Ok(string.Join(", ", _commands.Keys)));
        }

        public void Register(string name, ApexScenarioCommand command)
        {
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Command name is required.", nameof(name));
            if (command == null) throw new ArgumentNullException(nameof(command));
            _commands[name.Trim()] = command;
        }

        public void Unregister(string name)
        {
            if (!string.IsNullOrWhiteSpace(name)) _commands.Remove(name.Trim());
        }

        public ApexScenarioResult Execute(string line)
        {
            var tokens = Tokenize(line);
            if (tokens.Count == 0) return ApexScenarioResult.Fail("Empty command.");
            var name = tokens[0];
            tokens.RemoveAt(0);
            if (!_commands.TryGetValue(name, out var command))
            {
                var missing = ApexScenarioResult.Fail($"Unknown command: {name}");
                Record(line, missing);
                return missing;
            }

            ApexScenarioResult result;
            try { result = command(tokens); }
            catch (Exception ex) { result = ApexScenarioResult.Fail($"{ex.GetType().Name}: {ex.Message}"); }
            Record(line, result);
            return result;
        }

        private void Record(string line, ApexScenarioResult result)
        {
            var entry = $"> {line}\n{(result.Success ? "OK" : "FAIL")} // {result.Message}";
            _history.Add(entry);
            if (_history.Count > 40) _history.RemoveAt(0);
            Executed?.Invoke(line, result);
            Debug.Log($"[Apex Scenario] {entry}");
        }

        private static List<string> Tokenize(string line)
        {
            var result = new List<string>();
            if (string.IsNullOrWhiteSpace(line)) return result;
            var builder = new StringBuilder();
            var quoted = false;
            for (var i = 0; i < line.Length; i++)
            {
                var c = line[i];
                if (c == '"')
                {
                    quoted = !quoted;
                    continue;
                }
                if (char.IsWhiteSpace(c) && !quoted)
                {
                    if (builder.Length > 0)
                    {
                        result.Add(builder.ToString());
                        builder.Clear();
                    }
                    continue;
                }
                builder.Append(c);
            }
            if (builder.Length > 0) result.Add(builder.ToString());
            return result;
        }

        public void Shutdown()
        {
            _commands.Clear();
            _history.Clear();
            _registered = false;
        }
    }
}
