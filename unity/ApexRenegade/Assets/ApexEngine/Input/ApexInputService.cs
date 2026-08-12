using System;
using Apex.Core;
using Apex.Settings;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Apex.Input
{
    public sealed class ApexInputService : MonoBehaviour, IApexService
    {
        private const string BindingPrefsKey = "apex.input.bindings.v1";
        private ApexSettingsService _settings;

        public InputActionAsset Asset { get; private set; }
        public InputActionMap Gameplay { get; private set; }
        public InputAction Move { get; private set; }
        public InputAction Look { get; private set; }
        public InputAction Fire { get; private set; }
        public InputAction Aim { get; private set; }
        public InputAction Jump { get; private set; }
        public InputAction Sprint { get; private set; }
        public InputAction Crouch { get; private set; }
        public InputAction Reload { get; private set; }
        public InputAction Interact { get; private set; }
        public InputAction Bike { get; private set; }
        public InputAction Drift { get; private set; }
        public InputAction Boost { get; private set; }
        public InputAction Pause { get; private set; }

        public void Initialize(ApexServices services)
        {
            _settings = services.Get<ApexSettingsService>();
            BuildActions();
            LoadBindingOverrides();
            Gameplay.Enable();
            services.Register(this);
        }

        private void BuildActions()
        {
            Asset = ScriptableObject.CreateInstance<InputActionAsset>();
            Gameplay = new InputActionMap("Gameplay");
            Asset.AddActionMap(Gameplay);

            Move = Gameplay.AddAction("Move", InputActionType.Value, expectedControlLayout: "Vector2");
            Move.AddCompositeBinding("2DVector")
                .With("Up", "<Keyboard>/w").With("Down", "<Keyboard>/s")
                .With("Left", "<Keyboard>/a").With("Right", "<Keyboard>/d");
            Move.AddBinding("<Gamepad>/leftStick");

            Look = Gameplay.AddAction("Look", InputActionType.Value, expectedControlLayout: "Vector2");
            Look.AddBinding("<Mouse>/delta");
            Look.AddBinding("<Gamepad>/rightStick");

            Fire = AddButton("Fire", "<Mouse>/leftButton", "<Gamepad>/rightTrigger");
            Aim = AddButton("Aim", "<Mouse>/rightButton", "<Gamepad>/leftTrigger");
            Jump = AddButton("Jump", "<Keyboard>/space", "<Gamepad>/buttonSouth");
            Sprint = AddButton("Sprint", "<Keyboard>/leftShift", "<Gamepad>/leftStickPress");
            Crouch = AddButton("Crouch", "<Keyboard>/leftCtrl", "<Gamepad>/buttonEast");
            Reload = AddButton("Reload", "<Keyboard>/r", "<Gamepad>/buttonWest");
            Interact = AddButton("Interact", "<Keyboard>/e", "<Gamepad>/buttonNorth");
            Bike = AddButton("Bike", "<Keyboard>/v", "<Gamepad>/dpad/down");
            Drift = AddButton("Drift", "<Keyboard>/q", "<Gamepad>/leftShoulder");
            Boost = AddButton("Boost", "<Keyboard>/space", "<Gamepad>/buttonSouth");
            Pause = AddButton("Pause", "<Keyboard>/escape", "<Gamepad>/start");
        }

        private InputAction AddButton(string name, string keyboardMouse, string gamepad)
        {
            var action = Gameplay.AddAction(name, InputActionType.Button);
            action.AddBinding(keyboardMouse);
            action.AddBinding(gamepad);
            return action;
        }

        public Vector2 ReadMove() => Move.ReadValue<Vector2>();

        public Vector2 ReadLook(float dt, bool ads = false)
        {
            var raw = Look.ReadValue<Vector2>();
            var s = _settings.Data;
            var isMouse = Look.activeControl?.device is Mouse;
            if (isMouse)
                return raw * (0.02f * s.mouseSensitivity);

            var x = ShapeStick(raw.x, s.rightStickInnerDeadzone, s.rightStickOuterDeadzone, s.rightStickCurve);
            var y = ShapeStick(raw.y, s.rightStickInnerDeadzone, s.rightStickOuterDeadzone, s.rightStickCurve);
            if (s.invertY) y *= -1f;
            var adsScale = ads ? s.adsMultiplier : 1f;
            return new Vector2(x * s.controllerSensitivityX, y * s.controllerSensitivityY) * (210f * Mathf.Max(dt, 0.001f) * adsScale);
        }

        public static float ShapeStick(float value, float inner, float outer, float curve)
        {
            var sign = Mathf.Sign(value);
            var magnitude = Mathf.Abs(value);
            inner = Mathf.Clamp(inner, 0f, 0.95f);
            outer = Mathf.Clamp(outer, 0f, 0.95f - inner);
            if (magnitude <= inner) return 0f;
            var usable = Mathf.Max(0.001f, 1f - inner - outer);
            var normalized = Mathf.Clamp01((magnitude - inner) / usable);
            return sign * Mathf.Pow(normalized, Mathf.Max(1f, curve));
        }

        public bool Pressed(InputAction action) => action.WasPressedThisFrame();
        public bool Held(InputAction action) => action.IsPressed();

        public void StartInteractiveRebind(InputAction action, int bindingIndex, Action<bool> completed)
        {
            Gameplay.Disable();
            action.PerformInteractiveRebinding(bindingIndex)
                .WithCancelingThrough("<Keyboard>/escape")
                .OnComplete(op => { op.Dispose(); SaveBindingOverrides(); Gameplay.Enable(); completed?.Invoke(true); })
                .OnCancel(op => { op.Dispose(); Gameplay.Enable(); completed?.Invoke(false); })
                .Start();
        }

        public void SaveBindingOverrides()
        {
            PlayerPrefs.SetString(BindingPrefsKey, Asset.SaveBindingOverridesAsJson());
            PlayerPrefs.Save();
        }

        public void LoadBindingOverrides()
        {
            var json = PlayerPrefs.GetString(BindingPrefsKey, string.Empty);
            if (!string.IsNullOrWhiteSpace(json)) Asset.LoadBindingOverridesFromJson(json);
        }

        public void ResetBindingOverrides()
        {
            Asset.RemoveAllBindingOverrides();
            PlayerPrefs.DeleteKey(BindingPrefsKey);
        }

        public void Shutdown()
        {
            Gameplay?.Disable();
            if (Asset != null) Destroy(Asset);
        }
    }
}
