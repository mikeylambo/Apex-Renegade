using System.Collections;
using Apex.Core;
using Apex.Input;
using Apex.Settings;
using Apex.UI;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-850)]
    public sealed class ApexPortRuntimeShell : MonoBehaviour
    {
        private enum Page { Root, Settings, Graphics, Controls }

        private ApexInputService _input;
        private ApexSettingsService _settings;
        private ApexPauseService _pause;
        private RenegadeArsenalController _arsenal;
        private GUIStyle _title;
        private GUIStyle _label;
        private GUIStyle _value;
        private GUIStyle _button;
        private GUIStyle _selected;
        private bool _ready;
        private bool _rebinding;
        private Page _page;
        private int _selection;
        private float _nextNavigate;

        private static readonly string[] SettingLabels =
        {
            "Field of View", "Mouse Sensitivity", "Controller X", "Controller Y",
            "Right Stick Deadzone", "Look Response Curve", "Look Acceleration", "ADS Sensitivity",
            "Camera Shake", "Vibration", "Master Volume", "SFX Volume", "Invert Y", "Damage Indicators"
        };

        private static readonly string[] GraphicsLabels =
        {
            "Quality Budget", "Frame Rate Target", "VSync", "Fullscreen",
            "Shadow Distance", "LOD Bias", "Anti-Aliasing"
        };

        private static readonly int[] FrameRates = { 30, 60, 90, 120, 144 };
        private static readonly int[] AntiAliasingOptions = { 0, 2, 4, 8 };

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

            _arsenal = Object.FindFirstObjectByType<RenegadeArsenalController>();
            _pause.PauseChanged += OnPauseChanged;
            _ready = true;
        }

        private void Update()
        {
            if (!_ready || _input == null || _pause == null || _rebinding) return;

            if (_input.Pressed(_input.Pause))
            {
                if (_pause.IsPaused && _page != Page.Root)
                {
                    _page = Page.Root;
                    _selection = 0;
                }
                else _pause.TogglePause();
                return;
            }

            if (!_pause.IsPaused) return;
            if (_input.Pressed(_input.UICancel))
            {
                if (_page == Page.Root) _pause.SetPaused(false);
                else { _page = Page.Root; _selection = 0; }
                return;
            }

            HandleControllerNavigation();
        }

        private void HandleControllerNavigation()
        {
            var nav = _input.UINavigate.ReadValue<Vector2>();
            var now = Time.unscaledTime;
            if (now >= _nextNavigate && Mathf.Abs(nav.y) > 0.55f)
            {
                var count = _page switch
                {
                    Page.Root => 4,
                    Page.Settings => SettingLabels.Length,
                    Page.Graphics => GraphicsLabels.Length,
                    Page.Controls => ControlActions().Length,
                    _ => 1
                };
                _selection = (_selection + (nav.y < 0f ? 1 : -1) + count) % count;
                _nextNavigate = now + 0.16f;
            }

            if (now >= _nextNavigate && Mathf.Abs(nav.x) > 0.55f)
            {
                if (_page == Page.Settings) AdjustSetting(_selection, nav.x > 0f ? 1f : -1f);
                else if (_page == Page.Graphics) AdjustGraphics(_selection, nav.x > 0f ? 1 : -1);
                _nextNavigate = now + 0.09f;
            }

            if (!_input.Pressed(_input.UISubmit)) return;
            if (_page == Page.Root)
            {
                if (_selection == 0) _pause.SetPaused(false);
                else
                {
                    _page = _selection switch
                    {
                        1 => Page.Settings,
                        2 => Page.Graphics,
                        _ => Page.Controls
                    };
                    _selection = 0;
                }
            }
            else if (_page == Page.Settings)
            {
                if (_selection == 12) _settings.Data.invertY = !_settings.Data.invertY;
                else if (_selection == 13) _settings.Data.directionalDamageIndicators = !_settings.Data.directionalDamageIndicators;
                _pause.ApplyAndSaveSettings();
            }
            else if (_page == Page.Graphics)
            {
                if (_selection == 2) _settings.Data.vSync = !_settings.Data.vSync;
                else if (_selection == 3) _settings.Data.fullscreen = !_settings.Data.fullscreen;
                _pause.ApplyAndSaveSettings();
            }
            else if (_page == Page.Controls)
            {
                var actions = ControlActions();
                if (_selection >= 0 && _selection < actions.Length)
                {
                    _rebinding = true;
                    _input.StartInteractiveRebind(actions[_selection], true, _ => _rebinding = false);
                }
            }
        }

        private InputAction[] ControlActions() => new[]
        {
            _input.Fire, _input.Aim, _input.Jump, _input.Sprint, _input.Crouch, _input.Reload,
            _input.Interact, _input.Bike, _input.Drift, _input.Boost, _input.BikeFire, _input.Dash,
            _input.WeaponPrevious, _input.WeaponNext
        };

        private void AdjustSetting(int index, float direction)
        {
            var d = _settings.Data;
            switch (index)
            {
                case 0: d.fov = Mathf.Clamp(d.fov + direction * 2f, 70f, 120f); break;
                case 1: d.mouseSensitivity = Mathf.Clamp(d.mouseSensitivity + direction * 0.1f, 0.1f, 5f); break;
                case 2: d.controllerSensitivityX = Mathf.Clamp(d.controllerSensitivityX + direction * 0.1f, 0.1f, 5f); break;
                case 3: d.controllerSensitivityY = Mathf.Clamp(d.controllerSensitivityY + direction * 0.1f, 0.1f, 5f); break;
                case 4: d.rightStickInnerDeadzone = Mathf.Clamp(d.rightStickInnerDeadzone + direction * 0.01f, 0f, 0.6f); break;
                case 5: d.rightStickCurve = Mathf.Clamp(d.rightStickCurve + direction * 0.05f, 1f, 3f); break;
                case 6: d.lookAcceleration = Mathf.Clamp01(d.lookAcceleration + direction * 0.025f); break;
                case 7: d.adsMultiplier = Mathf.Clamp(d.adsMultiplier + direction * 0.025f, 0.1f, 1f); break;
                case 8: d.cameraShake = Mathf.Clamp01(d.cameraShake + direction * 0.05f); break;
                case 9: d.vibration = Mathf.Clamp01(d.vibration + direction * 0.05f); break;
                case 10: d.masterVolume = Mathf.Clamp01(d.masterVolume + direction * 0.05f); break;
                case 11: d.sfxVolume = Mathf.Clamp01(d.sfxVolume + direction * 0.05f); break;
                case 12: d.invertY = !d.invertY; break;
                case 13: d.directionalDamageIndicators = !d.directionalDamageIndicators; break;
            }
            _pause.ApplyAndSaveSettings();
        }

        private void AdjustGraphics(int index, int direction)
        {
            var d = _settings.Data;
            switch (index)
            {
                case 0: d.qualityPreset = Mathf.Clamp(d.qualityPreset + direction, 0, 3); break;
                case 1: d.targetFrameRate = CycleOption(FrameRates, d.targetFrameRate, direction); break;
                case 2: d.vSync = !d.vSync; break;
                case 3: d.fullscreen = !d.fullscreen; break;
                case 4: d.shadowDistance = Mathf.Clamp(d.shadowDistance + direction * 10f, 0f, 300f); break;
                case 5: d.lodBias = Mathf.Clamp(d.lodBias + direction * 0.1f, 0.4f, 3f); break;
                case 6: d.antiAliasing = CycleOption(AntiAliasingOptions, d.antiAliasing, direction); break;
            }
            _pause.ApplyAndSaveSettings();
        }

        private static int CycleOption(int[] values, int current, int direction)
        {
            var index = 0;
            var best = int.MaxValue;
            for (var i = 0; i < values.Length; i++)
            {
                var delta = Mathf.Abs(values[i] - current);
                if (delta >= best) continue;
                best = delta;
                index = i;
            }
            index = (index + (direction >= 0 ? 1 : -1) + values.Length) % values.Length;
            return values[index];
        }

        private void OnPauseChanged(bool paused)
        {
            Cursor.lockState = paused ? CursorLockMode.None : CursorLockMode.Locked;
            Cursor.visible = paused;
            _arsenal ??= Object.FindFirstObjectByType<RenegadeArsenalController>();
            if (_arsenal != null) _arsenal.enabled = !paused;
            if (!paused) { _page = Page.Root; _selection = 0; }
        }

        private void OnGUI()
        {
            if (!_ready || _pause == null || !_pause.IsPaused || _settings == null) return;
            EnsureStyles();

            GUI.color = new Color(0.01f, 0.014f, 0.022f, 0.86f);
            GUI.DrawTexture(new Rect(0f, 0f, Screen.width, Screen.height), Texture2D.whiteTexture);
            GUI.color = Color.white;

            var panel = new Rect(Mathf.Max(34f, Screen.width * 0.09f), Mathf.Max(28f, Screen.height * 0.055f), Mathf.Min(760f, Screen.width * 0.68f), Mathf.Min(860f, Screen.height * 0.90f));
            GUI.Box(panel, GUIContent.none);
            var title = _page switch
            {
                Page.Settings => "APEX // SETTINGS",
                Page.Graphics => "APEX // GRAPHICS",
                Page.Controls => "APEX // CONTROLS",
                _ => "APEX // PAUSED"
            };
            GUI.Label(new Rect(panel.x + 28f, panel.y + 20f, panel.width - 56f, 42f), title, _title);

            if (_page == Page.Root) DrawPauseRoot(panel);
            else if (_page == Page.Settings) DrawSettings(panel);
            else if (_page == Page.Graphics) DrawGraphics(panel);
            else DrawControls(panel);
        }

        private void DrawPauseRoot(Rect panel)
        {
            var labels = new[] { "RESUME", "SETTINGS", "GRAPHICS / PERFORMANCE", "CONTROLS / REMAP" };
            var x = panel.x + 30f;
            var y = panel.y + 92f;
            var width = Mathf.Min(420f, panel.width - 60f);
            for (var i = 0; i < labels.Length; i++)
            {
                var style = i == _selection ? _selected : _button;
                if (GUI.Button(new Rect(x, y + i * 54f, width, 42f), labels[i], style))
                {
                    _selection = i;
                    if (i == 0) _pause.SetPaused(false);
                    else
                    {
                        _page = i == 1 ? Page.Settings : (i == 2 ? Page.Graphics : Page.Controls);
                        _selection = 0;
                    }
                }
            }
            GUI.Label(new Rect(x, y + 244f, panel.width - 60f, 28f), "D-PAD / LS  Navigate    •    A  Select    •    B / ESC  Back", _label);
            GUI.Label(new Rect(x, y + 276f, panel.width - 60f, 28f), "D-Pad ↓  Bike / Recall    •    D-Pad ←/→  Weapons", _label);
        }

        private void DrawSettings(Rect panel)
        {
            var d = _settings.Data;
            var values = new[]
            {
                d.fov.ToString("0"), d.mouseSensitivity.ToString("0.00"), d.controllerSensitivityX.ToString("0.00"), d.controllerSensitivityY.ToString("0.00"),
                d.rightStickInnerDeadzone.ToString("0.00"), d.rightStickCurve.ToString("0.00"), d.lookAcceleration.ToString("0.00"), d.adsMultiplier.ToString("0.00"),
                d.cameraShake.ToString("0.00"), d.vibration.ToString("0.00"), d.masterVolume.ToString("0.00"), d.sfxVolume.ToString("0.00"),
                d.invertY ? "ON" : "OFF", d.directionalDamageIndicators ? "ON" : "OFF"
            };
            DrawRows(panel, SettingLabels, values, "D-PAD ←/→ adjust    •    A toggle    •    B back");
        }

        private void DrawGraphics(Rect panel)
        {
            var d = _settings.Data;
            var quality = new[] { "LOW", "MEDIUM", "HIGH", "ULTRA" }[Mathf.Clamp(d.qualityPreset, 0, 3)];
            var values = new[]
            {
                quality,
                $"{d.targetFrameRate} FPS",
                d.vSync ? "ON" : "OFF",
                d.fullscreen ? "ON" : "OFF",
                $"{d.shadowDistance:0} m",
                d.lodBias.ToString("0.00"),
                d.antiAliasing == 0 ? "OFF" : $"{d.antiAliasing}x"
            };
            DrawRows(panel, GraphicsLabels, values, "D-PAD ←/→ adjust    •    A toggle    •    B back");
        }

        private void DrawRows(Rect panel, string[] labels, string[] values, string footer)
        {
            var x = panel.x + 30f;
            var y = panel.y + 76f;
            var width = panel.width - 60f;
            for (var i = 0; i < labels.Length; i++)
            {
                if (i == _selection) DrawSelectionBar(x, y - 2f, width, 29f);
                GUI.Label(new Rect(x + 8f, y, width * 0.70f, 25f), labels[i], _label);
                GUI.Label(new Rect(x + width * 0.72f, y, width * 0.25f, 25f), values[i], _value);
                y += 31f;
            }
            GUI.Label(new Rect(x, y + 10f, width, 26f), footer, _label);
            if (_page == Page.Settings && GUI.Button(new Rect(x, y + 45f, 180f, 36f), "RESET SETTINGS", _button)) _pause.ResetSettings();
        }

        private void DrawControls(Rect panel)
        {
            var actions = ControlActions();
            var x = panel.x + 30f;
            var y = panel.y + 76f;
            var width = panel.width - 60f;
            for (var i = 0; i < actions.Length; i++)
            {
                if (i == _selection) DrawSelectionBar(x, y - 2f, width, 29f);
                GUI.Label(new Rect(x + 8f, y, width * 0.55f, 25f), actions[i].name, _label);
                GUI.Label(new Rect(x + width * 0.58f, y, width * 0.39f, 25f), _input.BindingDisplay(actions[i], true), _value);
                y += 31f;
            }
            GUI.Label(new Rect(x, y + 8f, width, 28f), _rebinding ? "PRESS A NEW GAMEPAD CONTROL…  ESC cancels" : "A  Rebind selected control    •    B  Back", _label);
            if (GUI.Button(new Rect(x, y + 44f, 190f, 36f), "RESET BINDINGS", _button)) _input.ResetBindingOverrides();
        }

        private void DrawSelectionBar(float x, float y, float width, float height)
        {
            var old = GUI.color;
            GUI.color = new Color(0.34f, 0.22f, 0.78f, 0.34f);
            GUI.DrawTexture(new Rect(x, y, width, height), Texture2D.whiteTexture);
            GUI.color = old;
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
            _selected = new GUIStyle(_button);
            _selected.normal.textColor = new Color(0.93f, 0.86f, 1f);
        }

        private void OnDestroy()
        {
            if (_pause != null) _pause.PauseChanged -= OnPauseChanged;
        }
    }
}
