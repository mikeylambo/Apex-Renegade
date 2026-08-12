using Apex.Combat;
using Apex.Debugging;
using Apex.Interaction;
using Apex.Settings;
using Apex.Traversal;
using Apex.World;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Apex.Renegade
{
    public sealed class ApexPortHudV2 : MonoBehaviour
    {
        private HealthComponent _health;
        private RenegadeArsenalController _arsenal;
        private ApexBikeMotor _bike;
        private ApexWorldRegionTracker _regions;
        private RenegadeLifeCycle _life;
        private Camera _camera;
        private ApexInteractionScanner _scanner;
        private RenegadeEscalationDirector _escalation;
        private ApexTelemetry _telemetry;
        private ApexSettingsService _settings;
        private GUIStyle _small;
        private GUIStyle _large;
        private GUIStyle _damage;
        private GUIStyle _center;
        private bool _debug;

        public void Configure(
            HealthComponent health,
            RenegadeArsenalController arsenal,
            ApexBikeMotor bike,
            ApexWorldRegionTracker regions,
            RenegadeLifeCycle life,
            Camera camera,
            ApexInteractionScanner scanner,
            RenegadeEscalationDirector escalation,
            ApexTelemetry telemetry,
            ApexSettingsService settings)
        {
            _health = health;
            _arsenal = arsenal;
            _bike = bike;
            _regions = regions;
            _life = life;
            _camera = camera;
            _scanner = scanner;
            _escalation = escalation;
            _telemetry = telemetry;
            _settings = settings;
        }

        private void Update()
        {
            if (Keyboard.current?.f8Key.wasPressedThisFrame == true) _debug = !_debug;
        }

        private void OnGUI()
        {
            var weapon = _arsenal?.DisplayWeapon;
            if (_health == null || weapon == null) return;
            EnsureStyles();
            var w = Screen.width;
            var h = Screen.height;
            var cx = w * 0.5f;
            var cy = h * 0.5f;

            if (_bike == null || !_bike.IsMounted) DrawReticle(cx, cy);

            if (_arsenal.HitmarkerVisible)
            {
                GUI.color = _arsenal.KillmarkerVisible ? new Color(1f, 0.72f, 0.28f, 1f) : Color.white;
                var oldMatrix = GUI.matrix;
                GUIUtility.RotateAroundPivot(45f, new Vector2(cx, cy));
                DrawRect(new Rect(cx - 9f, cy - 1f, 18f, 2f));
                DrawRect(new Rect(cx - 1f, cy - 9f, 2f, 18f));
                GUI.matrix = oldMatrix;
            }

            GUI.color = Color.white;
            GUI.Label(new Rect(28f, h - 82f, 360f, 28f), $"HP {Mathf.CeilToInt(_health.Health):000}   SH {Mathf.CeilToInt(_health.Shield):000}", _large);
            GUI.Label(new Rect(w - 380f, h - 84f, 350f, 30f), $"{weapon.Definition.displayName.ToUpperInvariant()}   {weapon.Magazine:00} / {weapon.Reserve:000}", _large);
            GUI.Label(new Rect(28f, 24f, 520f, 24f), string.IsNullOrWhiteSpace(_regions?.ActiveRegion) ? "APEX // TRANSIT" : $"APEX // {_regions.ActiveRegion.ToUpperInvariant()}", _small);

            if (_escalation != null)
            {
                GUI.Label(new Rect(w * 0.5f - 260f, 22f, 520f, 24f), $"REGIONAL PRESSURE // {_escalation.PressureLabel}", _center);
                DrawMeter(new Rect(w * 0.5f - 190f, 52f, 380f, 5f), _escalation.Pressure?.Value ?? 0f, new Color(1f, 0.55f, 0.15f));
                GUI.Label(new Rect(28f, h - 48f, 420f, 24f), $"REFUSAL  {_escalation.RefusalLabel}", _small);
                DrawMeter(new Rect(28f, h - 22f, 240f, 5f), _escalation.Refusal?.Value ?? 0f, new Color(0.55f, 0.36f, 1f));
            }

            if (weapon.State == WeaponState.Reloading)
                GUI.Label(new Rect(w - 380f, h - 50f, 350f, 24f), "RELOADING", _small);

            if (_bike != null)
            {
                var bikeText = _bike.IsMounted
                    ? $"BIKE  {Mathf.Abs(_bike.Speed) * 3.6f:000} km/h   DRIVE {_bike.BoostEnergy:000}   WHEELIE {_bike.WheelieAmount * 100f:00}%   RB FIRE"
                    : (_bike.IsRecalling ? "BIKE // RECALLING" : "D-PAD ↓ / V // MOUNT / RECALL");
                GUI.Label(new Rect(w * 0.5f - 320f, h - 42f, 640f, 24f), bikeText, _center);
            }

            if (_scanner?.CurrentPrompt is InteractionPrompt prompt)
                GUI.Label(new Rect(cx - 310f, h * 0.72f, 620f, 28f), $"[ E / Y ]  {prompt.Label}", _center);

            DrawDamageFeedback(w, h);

            if (_life != null && _life.IsRespawning)
            {
                GUI.color = new Color(0f, 0f, 0f, 0.7f);
                GUI.DrawTexture(new Rect(0f, 0f, w, h), Texture2D.whiteTexture);
                GUI.color = Color.white;
                GUI.Label(new Rect(cx - 220f, cy - 20f, 440f, 40f), "RECONSTITUTING // CHECKPOINT", _center);
            }

            if (_debug && _telemetry != null)
            {
                GUI.color = new Color(0f, 0f, 0f, 0.68f);
                GUI.DrawTexture(new Rect(w - 260f, 20f, 235f, 120f), Texture2D.whiteTexture);
                GUI.color = Color.white;
                GUI.Label(new Rect(w - 245f, 30f, 210f, 100f),
                    $"F8 // APEX DIAGNOSTICS\nFPS  {_telemetry.SmoothedFps:0.0}\nFRAME  {_telemetry.SmoothedFrameMs:0.00} ms\nBIKE  {(_bike?.PlanarSpeed ?? 0f):0.0} m/s\nUNITY  {Application.unityVersion}", _small);
            }
        }

        private void DrawReticle(float cx, float cy)
        {
            GUI.color = new Color(0.72f, 0.82f, 1f, 0.88f);
            DrawRect(new Rect(cx - 10f, cy - 1f, 7f, 2f));
            DrawRect(new Rect(cx + 3f, cy - 1f, 7f, 2f));
            DrawRect(new Rect(cx - 1f, cy - 10f, 2f, 7f));
            DrawRect(new Rect(cx - 1f, cy + 3f, 2f, 7f));
        }

        private void DrawDamageFeedback(float w, float h)
        {
            if (_life == null) return;
            var age = Time.unscaledTime - _life.LastDamageTime;
            if (age >= 0.38f) return;

            GUI.color = new Color(1f, 0.18f, 0.12f, 0.23f * (1f - age / 0.38f));
            GUI.DrawTexture(new Rect(0f, 0f, w, h), Texture2D.whiteTexture);
            GUI.color = Color.white;

            if (_camera == null || (_settings != null && !_settings.Data.directionalDamageIndicators)) return;
            var local = _camera.transform.InverseTransformDirection(_life.LastDamageDirection);
            string glyph;
            Rect rect;
            if (Mathf.Abs(local.x) > Mathf.Abs(local.z))
            {
                glyph = local.x > 0f ? ">" : "<";
                rect = local.x > 0f ? new Rect(w - 92f, h * 0.5f - 30f, 60f, 60f) : new Rect(32f, h * 0.5f - 30f, 60f, 60f);
            }
            else
            {
                glyph = local.z > 0f ? "▲" : "▼";
                rect = local.z > 0f ? new Rect(w * 0.5f - 30f, 55f, 60f, 60f) : new Rect(w * 0.5f - 30f, h - 125f, 60f, 60f);
            }
            GUI.Label(rect, glyph, _damage);
        }

        private static void DrawMeter(Rect rect, float value, Color fill)
        {
            var old = GUI.color;
            GUI.color = new Color(1f, 1f, 1f, 0.16f);
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = fill;
            GUI.DrawTexture(new Rect(rect.x, rect.y, rect.width * Mathf.Clamp01(value), rect.height), Texture2D.whiteTexture);
            GUI.color = old;
        }

        private void EnsureStyles()
        {
            if (_small != null) return;
            _small = new GUIStyle(GUI.skin.label) { fontSize = 15, fontStyle = FontStyle.Bold };
            _small.normal.textColor = new Color(0.75f, 0.84f, 0.96f);
            _large = new GUIStyle(_small) { fontSize = 19 };
            _damage = new GUIStyle(_large) { fontSize = 34, alignment = TextAnchor.MiddleCenter };
            _damage.normal.textColor = new Color(1f, 0.32f, 0.22f);
            _center = new GUIStyle(_small) { alignment = TextAnchor.MiddleCenter };
        }

        private static void DrawRect(Rect rect) => GUI.DrawTexture(rect, Texture2D.whiteTexture);
    }
}
