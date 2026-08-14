using System.Collections;
using Apex.Core;
using Apex.Save;
using Apex.Traversal;
using Apex.World;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(400)]
    public sealed class RenegadeNavigationHud : MonoBehaviour
    {
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private ApexWorldRegionTracker _regions;
        private ApexSaveService _save;
        private GUIStyle _compass;
        private GUIStyle _small;
        private string _checkpointText = string.Empty;
        private float _checkpointUntil;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureHud()
        {
            if (Object.FindFirstObjectByType<RenegadeNavigationHud>() != null) return;
            new GameObject("Apex Navigation HUD").AddComponent<RenegadeNavigationHud>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                _regions = Object.FindFirstObjectByType<ApexWorldRegionTracker>();
                if (ApexRuntime.IsInitialized && ApexRuntime.Services.TryGet<ApexSaveService>(out _save) && _player != null && _bike != null)
                {
                    _save.CheckpointChanged += OnCheckpointChanged;
                    yield break;
                }
                yield return null;
            }
        }

        private void OnCheckpointChanged(ApexCheckpointData checkpoint)
        {
            _checkpointText = $"CHECKPOINT // {(string.IsNullOrWhiteSpace(checkpoint.regionId) ? checkpoint.checkpointId : checkpoint.regionId).ToUpperInvariant()}";
            _checkpointUntil = Time.unscaledTime + 2.2f;
        }

        private void OnGUI()
        {
            if (_player == null || _bike == null) return;
            EnsureStyles();
            var observer = _bike.IsMounted ? _bike.transform : _player.transform;
            var heading = Mathf.Repeat(observer.eulerAngles.y, 360f);
            var cardinal = Cardinal(heading);
            GUI.Label(new Rect(Screen.width * 0.5f - 170f, 72f, 340f, 24f), $"{cardinal} // {heading:000}°", _compass);

            var target = NextLandmark(observer.position, out var label);
            var to = target - observer.position;
            to.y = 0f;
            if (to.sqrMagnitude > 4f)
            {
                var bearing = Mathf.Repeat(Mathf.Atan2(to.x, to.z) * Mathf.Rad2Deg, 360f);
                var delta = Mathf.DeltaAngle(heading, bearing);
                var arrow = Mathf.Abs(delta) < 8f ? "▲" : (delta > 0f ? "▶" : "◀");
                GUI.Label(new Rect(Screen.width * 0.5f - 300f, 98f, 600f, 22f), $"{arrow} {label} // {to.magnitude:0} m", _small);
            }

            if (Time.unscaledTime < _checkpointUntil)
            {
                var fade = Mathf.Clamp01((_checkpointUntil - Time.unscaledTime) / 0.45f);
                var old = GUI.color;
                GUI.color = new Color(0.78f, 0.88f, 1f, fade);
                GUI.Label(new Rect(Screen.width * 0.5f - 300f, Screen.height * 0.24f, 600f, 28f), _checkpointText, _compass);
                GUI.color = old;
            }
        }

        private Vector3 NextLandmark(Vector3 position, out string label)
        {
            if (position.z > -650f)
            {
                label = "THE EXPANSE";
                return new Vector3(0f, 0f, -760f);
            }
            if (position.z > -2750f)
            {
                label = "VERTICAL MEGACITY";
                return new Vector3(0f, 0f, -2980f);
            }
            label = "CENTRAL NEEDLE";
            return new Vector3(0f, 0f, -4150f);
        }

        private static string Cardinal(float heading)
        {
            var index = Mathf.RoundToInt(heading / 45f) & 7;
            return index switch
            {
                0 => "N",
                1 => "NE",
                2 => "E",
                3 => "SE",
                4 => "S",
                5 => "SW",
                6 => "W",
                _ => "NW"
            };
        }

        private void EnsureStyles()
        {
            if (_compass != null) return;
            _compass = new GUIStyle(GUI.skin.label) { fontSize = 15, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            _compass.normal.textColor = new Color(0.78f, 0.87f, 1f);
            _small = new GUIStyle(_compass) { fontSize = 12 };
            _small.normal.textColor = new Color(0.68f, 0.76f, 0.88f);
        }

        private void OnDestroy()
        {
            if (_save != null) _save.CheckpointChanged -= OnCheckpointChanged;
        }
    }
}
