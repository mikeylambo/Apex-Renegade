using System.Collections;
using Apex.Core;
using Apex.Input;
using Apex.Settings;
using Apex.UI;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-850)]
    public sealed class ApexPortRuntimeShell : MonoBehaviour
    {
        private ApexInputService _input;
        private ApexSettingsService _settings;
        private ApexPauseService _pause;
        private RenegadeWeaponController _weapon;
        private GUIStyle _title;
        private GUIStyle _label;
        private GUIStyle _value;
        private GUIStyle _button;
        private bool _ready;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureShell()
        {
            if (Object.FindFirstObjectByType<ApexPortRuntimeShell>() != null) return;
            new GameObject("Apex Runtime Shell").AddComponent<ApexPortRuntimeShell>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            while (!ApexRuntime.IsInitialized ||
                   !ApexRuntime.Services.TryGet<ApexInputService>(out _input) ||
                   !ApexRuntime.Services.TryGet<ApexSettingsService>(out _settings))
                yield return null;

            if (!ApexRuntime.Services.TryGet<ApexPauseService>(out _pause))
            {
                _pause = new ApexPauseService();
                _pause.Initialize(ApexRuntime.Services);
            }

            _weapon = Object.FindFirstObjectByType<RenegadeWeaponController>();
            _pause.PauseChanged += OnPauseChanged;
            _ready = true;
        }

        private void Update()
        {
            if (!_ready || _input == null || _pause == null) return;
            if (!_input.Pressed(_input.Pause)) return;

            if (_pause.SettingsOpen)
                _pause.SetSettingsOpen(false);
            else
                _pause.TogglePause();
        }

        private void OnPauseChanged(bool paused)
        {
            Cursor.lockState = paused ? CursorLockMode.None : CursorLockMode.Locked;
            Cursor.visible = paused;
            _weapon ??= Object.FindFirstObjectByType<RenegadeWeaponController>();
            if (_weapon != null) _weapon.enabled = !paused;
        }

        private void OnGUI()
        {
            if (!_ready || _pause == null || !_pause.IsPaused || _settings == null) return;
            EnsureStyles();

            GUI.color = new Color(0.01f, 0.014f, 0.022f, 0.82f);
            GUI.DrawTexture(new Rect(0f, 0f, Screen.width, Screen.height), Texture2D.whiteTexture);
            GUI.color = Color.white;

            var panel = new Rect(Mathf.Max(34f, Screen.width * 0.09f), Mathf.Max(32f, Screen.height * 0.08f), Mathf.Min(680f, Screen.width * 0.62f), Mathf.Min(790f, Screen.height * 0.84f));
            GUI.Box(panel, GUIContent.none);
            GUI.Label(new Rect(panel.x + 28f, panel.y + 22f, panel.width - 56f, 42f), _pause.SettingsOpen ? "APEX // SETTINGS" : "APEX // PAUSED", _title);

            if (!_pause.SettingsOpen)
            {
                DrawPauseRoot(panel);
                return;
            }

            DrawSettings(panel);
        }

        private void DrawPauseRoot(Rect panel)
        {
            var x = panel.x + 30f;
            var y = panel.y + 92f;
            var width = Mathf.Min(360f, panel.width - 60f);
            if (GUI.Button(new Rect(x, y, width, 42f), "RESUME", _button)) _pause.SetPaused(false);
            if (GUI.Button(new Rect(x, y + 54f, width, 42f), "SETTINGS", _button)) _pause.SetSettingsOpen(true);
            GUI.Label(new Rect(x, y + 132f, panel.width - 60f, 28f), "ESC / MENU  Resume    •    D-Pad ↓  Bike / Recall", _label);
            GUI.Label(new Rect(x, y + 164f, panel.width - 60f, 28f), "RT  Fire / Throttle    •    RB  Bike Fire    •    LT  ADS / Brake", _label);
        }

        private void DrawSettings(Rect panel)
        {
            var data = _settings.Data;
            var x = panel.x + 30f;
            var y = panel.y + 82f;
            var width = panel.width - 60f;
            var row = 36f;

            data.fov = DrawSlider("Field of View", data.fov, 70f, 120f, x, ref y, width, row, "0");
            data.mouseSensitivity = DrawSlider("Mouse Sensitivity", data.mouseSensitivity, 0.1f, 5f, x, ref y, width, row, "0.00");
            data.controllerSensitivityX = DrawSlider("Controller X", data.controllerSensitivityX, 0.1f, 5f, x, ref y, width, row, "0.00");
            data.controllerSensitivityY = DrawSlider("Controller Y", data.controllerSensitivityY, 0.1f, 5f, x, ref y, width, row, "0.00");
            data.rightStickInnerDeadzone = DrawSlider("Right Stick Deadzone", data.rightStickInnerDeadzone, 0f, 0.6f, x, ref y, width, row, "0.00");
            data.rightStickCurve = DrawSlider("Look Response Curve", data.rightStickCurve, 1f, 3f, x, ref y, width, row, "0.00");
            data.lookAcceleration = DrawSlider("Look Acceleration", data.lookAcceleration, 0f, 1f, x, ref y, width, row, "0.00");
            data.adsMultiplier = DrawSlider("ADS Sensitivity", data.adsMultiplier, 0.1f, 1f, x, ref y, width, row, "0.00");
            data.cameraShake = DrawSlider("Camera Shake", data.cameraShake, 0f, 1f, x, ref y, width, row, "0.00");
            data.vibration = DrawSlider("Vibration", data.vibration, 0f, 1f, x, ref y, width, row, "0.00");
            data.masterVolume = DrawSlider("Master Volume", data.masterVolume, 0f, 1f, x, ref y, width, row, "0.00");
            data.sfxVolume = DrawSlider("SFX Volume", data.sfxVolume, 0f, 1f, x, ref y, width, row, "0.00");

            data.invertY = GUI.Toggle(new Rect(x, y, width * 0.45f, 28f), data.invertY, "Invert Y");
            data.directionalDamageIndicators = GUI.Toggle(new Rect(x + width * 0.48f, y, width * 0.5f, 28f), data.directionalDamageIndicators, "Directional Damage Indicators");
            y += 38f;

            var buttonWidth = (width - 24f) / 3f;
            if (GUI.Button(new Rect(x, y, buttonWidth, 38f), "APPLY", _button)) _pause.ApplyAndSaveSettings();
            if (GUI.Button(new Rect(x + buttonWidth + 12f, y, buttonWidth, 38f), "RESET", _button)) _pause.ResetSettings();
            if (GUI.Button(new Rect(x + (buttonWidth + 12f) * 2f, y, buttonWidth, 38f), "BACK", _button))
            {
                _pause.ApplyAndSaveSettings();
                _pause.SetSettingsOpen(false);
            }
        }

        private float DrawSlider(string label, float value, float min, float max, float x, ref float y, float width, float row, string format)
        {
            GUI.Label(new Rect(x, y, width * 0.40f, 24f), label, _label);
            value = GUI.HorizontalSlider(new Rect(x + width * 0.41f, y + 7f, width * 0.43f, 22f), value, min, max);
            GUI.Label(new Rect(x + width * 0.86f, y, width * 0.14f, 24f), value.ToString(format), _value);
            y += row;
            return value;
        }

        private void EnsureStyles()
        {
            if (_title != null) return;
            _title = new GUIStyle(GUI.skin.label) { fontSize = 28, fontStyle = FontStyle.Bold };
            _title.normal.textColor = new Color(0.82f, 0.88f, 1f);
            _label = new GUIStyle(GUI.skin.label) { fontSize = 14 };
            _label.normal.textColor = new Color(0.72f, 0.79f, 0.9f);
            _value = new GUIStyle(_label) { alignment = TextAnchor.MiddleRight, fontStyle = FontStyle.Bold };
            _button = new GUIStyle(GUI.skin.button) { fontSize = 16, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleLeft, padding = new RectOffset(14, 10, 6, 6) };
        }

        private void OnDestroy()
        {
            if (_pause != null) _pause.PauseChanged -= OnPauseChanged;
        }
    }
}
