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
        private Vector2 _controllerLookVelocity;

        public InputActionAsset Asset { get; private set; }
        public InputActionMap Gameplay { get; private set; }
        public InputActionMap UI { get; private set; }
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
        public InputAction BikeFire { get; private set; }
        public InputAction Dash { get; private set; }
        public InputAction Surge { get; private set; }
        public InputAction Flight { get; private set; }
        public InputAction WeaponNext { get; private set; }
        public InputAction WeaponPrevious { get; private set; }
        public InputAction Pause { get; private set; }
        public InputAction UINavigate { get; private set; }
        public InputAction UISubmit { get; private set; }
        public InputAction UICancel { get; private set; }
        public bool UsingGamepad { get; private set; }

        public void Initialize(ApexServices services)
        {
            _settings = services.Get<ApexSettingsService>();
            BuildActions();
            LoadBindingOverrides();
            Gameplay.Enable();
            UI.Enable();
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

            Fire = AddButton(Gameplay, "Fire", "<Mouse>/leftButton", "<Gamepad>/rightTrigger");
            Aim = AddButton(Gameplay, "Aim", "<Mouse>/rightButton", "<Gamepad>/leftTrigger");
            Jump = AddButton(Gameplay, "Jump", "<Keyboard>/space", "<Gamepad>/buttonSouth");
            Sprint = AddButton(Gameplay, "Sprint", "<Keyboard>/leftShift", "<Gamepad>/leftStickPress");
            Crouch = AddButton(Gameplay, "Crouch", "<Keyboard>/leftCtrl", "<Gamepad>/buttonEast");
            Reload = AddButton(Gameplay, "Reload", "<Keyboard>/r", "<Gamepad>/buttonWest");
            Interact = AddButton(Gameplay, "Interact", "<Keyboard>/e", "<Gamepad>/buttonNorth");
            Bike = AddButton(Gameplay, "Bike", "<Keyboard>/v", "<Gamepad>/dpad/down");
            Drift = AddButton(Gameplay, "Drift", "<Keyboard>/q", "<Gamepad>/leftShoulder");
            Boost = AddButton(Gameplay, "Boost", "<Keyboard>/space", "<Gamepad>/buttonSouth");
            BikeFire = AddButton(Gameplay, "BikeFire", "<Keyboard>/f", "<Gamepad>/rightShoulder");
            Dash = AddButton(Gameplay, "Dash", "<Keyboard>/leftAlt", "<Gamepad>/leftShoulder");
            Surge = AddButton(Gameplay, "Surge", "<Keyboard>/x", "<Gamepad>/rightShoulder");
            Flight = AddButton(Gameplay, "Flight", "<Keyboard>/g", "<Gamepad>/dpad/up");
            WeaponNext = AddButton(Gameplay, "WeaponNext", "<Keyboard>/2", "<Gamepad>/dpad/right");
            WeaponPrevious = AddButton(Gameplay, "WeaponPrevious", "<Keyboard>/1", "<Gamepad>/dpad/left");
            Pause = AddButton(Gameplay, "Pause", "<Keyboard>/escape", "<Gamepad>/start");

            UI = new InputActionMap("UI");
            Asset.AddActionMap(UI);
            UINavigate = UI.AddAction("Navigate", InputActionType.Value, expectedControlLayout: "Vector2");
            UINavigate.AddCompositeBinding("2DVector")
                .With("Up", "<Keyboard>/upArrow").With("Down", "<Keyboard>/downArrow")
                .With("Left", "<Keyboard>/leftArrow").With("Right", "<Keyboard>/rightArrow");
            UINavigate.AddBinding("<Gamepad>/dpad");
            UINavigate.AddBinding("<Gamepad>/leftStick");
            UISubmit = AddButton(UI, "Submit", "<Keyboard>/enter", "<Gamepad>/buttonSouth");
            UICancel = AddButton(UI, "Cancel", "<Keyboard>/escape", "<Gamepad>/buttonEast");
        }

        private static InputAction AddButton(InputActionMap map, string name, string keyboardMouse, string gamepad)
        {
            var action = map.AddAction(name, InputActionType.Button);
            action.AddBinding(keyboardMouse);
            action.AddBinding(gamepad);
            return action;
        }

        public Vector2 ReadMove()
        {
            var move = Move.ReadValue<Vector2>();
            if (Move.activeControl != null) UsingGamepad = Move.activeControl.device is Gamepad;
            return move;
        }

        public Vector2 ReadLook(float dt, bool ads = false)
        {
            var raw = Look.ReadValue<Vector2>();
            var s = _settings.Data;
            var isMouse = Look.activeControl?.device is Mouse;
            if (Look.activeControl != null) UsingGamepad = Look.activeControl.device is Gamepad;

            if (isMouse)
            {
                _controllerLookVelocity = Vector2.zero;
                return raw * (0.02f * s.mouseSensitivity * (ads ? s.adsMultiplier : 1f));
            }

            var shaped = ShapeStick(raw, s.rightStickInnerDeadzone, s.rightStickOuterDeadzone, s.rightStickCurve);
            if (s.invertY) shaped.y *= -1f;
            var adsScale = ads ? s.adsMultiplier : 1f;
            var targetDegreesPerSecond = new Vector2(
                shaped.x * s.controllerSensitivityX,
                shaped.y * s.controllerSensitivityY) * (210f * adsScale);

            var responseSharpness = Mathf.Lerp(55f, 8f, Mathf.Clamp01(s.lookAcceleration));
            var blend = 1f - Mathf.Exp(-responseSharpness * Mathf.Max(dt, 0.001f));
            _controllerLookVelocity = Vector2.Lerp(_controllerLookVelocity, targetDegreesPerSecond, blend);
            return _controllerLookVelocity * Mathf.Max(dt, 0.001f);
        }

        public static Vector2 ShapeStick(Vector2 value, float inner, float outer, float curve)
        {
            var magnitude = Mathf.Clamp01(value.magnitude);
            inner = Mathf.Clamp(inner, 0f, 0.95f);
            outer = Mathf.Clamp(outer, 0f, 0.95f - inner);
            if (magnitude <= inner || magnitude <= 0.0001f) return Vector2.zero;
            var usable = Mathf.Max(0.001f, 1f - inner - outer);
            var normalized = Mathf.Clamp01((magnitude - inner) / usable);
            var shapedMagnitude = Mathf.Pow(normalized, Mathf.Max(1f, curve));
            return value.normalized * shapedMagnitude;
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

        public bool Pressed(InputAction action) => action != null && action.WasPressedThisFrame();
        public bool Held(InputAction action) => action != null && action.IsPressed();

        public int FindBindingIndex(InputAction action, bool gamepad)
        {
            if (action == null) return -1;
            var token = gamepad ? "<Gamepad>" : "<Keyboard>";
            for (var i = 0; i < action.bindings.Count; i++)
            {
                var binding = action.bindings[i];
                var path = string.IsNullOrWhiteSpace(binding.overridePath) ? binding.path : binding.overridePath;
                if (!string.IsNullOrWhiteSpace(path) && path.IndexOf(token, StringComparison.OrdinalIgnoreCase) >= 0)
                    return i;
            }
            return -1;
        }

        public string BindingDisplay(InputAction action, bool gamepad)
        {
            var index = FindBindingIndex(action, gamepad);
            return index >= 0 ? action.GetBindingDisplayString(index) : "—";
        }

        public void StartInteractiveRebind(InputAction action, bool gamepad, Action<bool> completed)
        {
            var bindingIndex = FindBindingIndex(action, gamepad);
            if (bindingIndex < 0)
            {
                completed?.Invoke(false);
                return;
            }
            StartInteractiveRebind(action, bindingIndex, completed);
        }

        public void StartInteractiveRebind(InputAction action, int bindingIndex, Action<bool> completed)
        {
            if (action == null || bindingIndex < 0 || bindingIndex >= action.bindings.Count)
            {
                completed?.Invoke(false);
                return;
            }
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
            PlayerPrefs.Save();
        }

        public void Shutdown()
        {
            Gameplay?.Disable();
            UI?.Disable();
            if (Asset != null) Destroy(Asset);
        }
    }
}
