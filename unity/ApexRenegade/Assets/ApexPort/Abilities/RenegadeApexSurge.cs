using System.Collections;
using Apex.Abilities;
using Apex.Audio;
using Apex.Combat;
using Apex.Core;
using Apex.Input;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade.Abilities
{
    [DefaultExecutionOrder(-540)]
    public sealed class RenegadeApexSurge : MonoBehaviour
    {
        private readonly ApexChargeMeter _charge = new();
        private readonly ApexAbilityRuntime _surge = new("apex-surge", 1.5f, 6f);
        private ApexInputService _input;
        private ApexHapticsService _haptics;
        private ApexAudioService _audio;
        private RenegadeArsenalController _arsenal;
        private RenegadeEscalationDirector _escalation;
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private HealthComponent _health;
        private ApexPortCameraV2 _camera;
        private Transform _aura;
        private float _nextAuraTick;

        public ApexChargeMeter Charge => _charge;
        public ApexAbilityRuntime Surge => _surge;
        public bool Active => _surge.Active;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureAbility()
        {
            if (Object.FindFirstObjectByType<RenegadeApexSurge>() != null) return;
            new GameObject("Apex Surge Ability").AddComponent<RenegadeApexSurge>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _arsenal = Object.FindFirstObjectByType<RenegadeArsenalController>();
                _escalation = Object.FindFirstObjectByType<RenegadeEscalationDirector>();
                _player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                _camera = Object.FindFirstObjectByType<ApexPortCameraV2>();
                if (ApexRuntime.IsInitialized &&
                    ApexRuntime.Services.TryGet<ApexInputService>(out _input) &&
                    ApexRuntime.Services.TryGet<ApexAudioService>(out _audio) &&
                    ApexRuntime.Services.TryGet<ApexHapticsService>(out _haptics) &&
                    _arsenal != null && _escalation?.Pressure != null && _player != null)
                {
                    _health = _player.GetComponent<HealthComponent>();
                    _arsenal.HitConfirmed += OnHitConfirmed;
                    if (_health != null) _health.Damaged += OnDamaged;
                    _surge.Activated += OnActivated;
                    _surge.Ended += OnEnded;
                    BuildAura();
                    yield break;
                }
                yield return null;
            }
            Debug.LogWarning("[Apex Surge] Could not resolve runtime dependencies.");
        }

        private void Update()
        {
            if (_input == null || Time.timeScale <= 0f) return;
            _surge.Tick(Time.deltaTime);

            if (_input.Pressed(_input.Surge) && _charge.Full && !_surge.Active && (_bike == null || !_bike.IsMounted))
            {
                if (_charge.TryConsume() && _surge.TryActivate())
                    _nextAuraTick = 0f;
            }

            if (_surge.Active)
            {
                if (_aura != null)
                {
                    _aura.position = _player.transform.position + Vector3.up * 1f;
                    var pulse = 1f + Mathf.Sin(Time.time * 8f) * 0.08f;
                    _aura.localScale = Vector3.one * (2.8f * pulse);
                    _aura.Rotate(Vector3.up, 80f * Time.deltaTime, Space.World);
                }

                _nextAuraTick -= Time.deltaTime;
                if (_nextAuraTick <= 0f)
                {
                    _nextAuraTick = 0.55f;
                    AuraPulse();
                }
            }
        }

        private void OnHitConfirmed(Vector3 _, bool killed)
        {
            if (_surge.Active) return;
            _charge.Add(killed ? 0.11f : 0.018f);
        }

        private void OnDamaged(DamagePayload payload, float health, float shield)
        {
            if (_surge.Active || _health == null) return;
            var health01 = _health.MaxHealth > 0f ? health / _health.MaxHealth : 1f;
            _charge.Add(Mathf.Lerp(0.015f, 0.065f, 1f - health01));
        }

        private void OnActivated()
        {
            _audio?.Play("bike.boost", 0.95f, ApexAudioBus.Sfx, 0.72f);
            _haptics?.Pulse(0.75f, 1f, 0.28f);
            _camera?.Impulse.Kick(new Vector3(0f, 0.02f, -0.12f), new Vector3(-3.5f, 0f, 0f));
            _camera?.Impulse.Shake(0.55f, 28f);
            _health?.RestoreShield(18f);
            _escalation?.Pressure?.Add(0.12f);
            _escalation?.Refusal?.Add(0.16f);
            if (_aura != null) _aura.gameObject.SetActive(true);
            RadialBurst(30f, 55f, 6.5f);
        }

        private void AuraPulse()
        {
            _health?.RestoreShield(2.5f);
            RadialBurst(11f, 7f, 1.2f);
        }

        private void RadialBurst(float radius, float damage, float stagger)
        {
            if (_player == null) return;
            var colliders = Physics.OverlapSphere(_player.transform.position, radius, ~0, QueryTriggerInteraction.Ignore);
            for (var i = 0; i < colliders.Length; i++)
            {
                var enemy = colliders[i].GetComponentInParent<RenegadeEnemyAgent>();
                if (enemy == null || enemy.Health == null || !enemy.Health.IsAlive) continue;
                var direction = enemy.transform.position - _player.transform.position;
                direction.y = 0f;
                if (direction.sqrMagnitude < 0.001f) direction = _player.transform.forward;
                direction.Normalize();
                enemy.Health.ApplyDamage(new DamagePayload(damage, enemy.AimAssistPoint, direction, DamageKind.Energy, _player.gameObject));
                enemy.NotifyHit(enemy.AimAssistPoint, direction * stagger);
            }
        }

        private void OnEnded()
        {
            if (_aura != null) _aura.gameObject.SetActive(false);
            _audio?.Play("ui.confirm", 0.35f, ApexAudioBus.Sfx, 0.72f);
        }

        private void BuildAura()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "Apex Surge // Spectral Aura";
            Destroy(go.GetComponent<Collider>());
            var template = Resources.Load<Material>("Apex/RuntimeLit");
            if (template != null)
            {
                var material = new Material(template);
                material.color = new Color(0.16f, 0.07f, 0.42f);
                if (material.HasProperty("_EmissionColor"))
                {
                    material.EnableKeyword("_EMISSION");
                    material.SetColor("_EmissionColor", new Color(0.65f, 0.20f, 1.5f));
                }
                go.GetComponent<Renderer>().material = material;
            }
            _aura = go.transform;
            _aura.SetParent(transform, true);
            go.SetActive(false);
        }

        private void OnDestroy()
        {
            if (_arsenal != null) _arsenal.HitConfirmed -= OnHitConfirmed;
            if (_health != null) _health.Damaged -= OnDamaged;
            _surge.Activated -= OnActivated;
            _surge.Ended -= OnEnded;
        }
    }

    public sealed class RenegadeApexSurgeHud : MonoBehaviour
    {
        private RenegadeApexSurge _surge;
        private GUIStyle _label;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureHud()
        {
            if (Object.FindFirstObjectByType<RenegadeApexSurgeHud>() != null) return;
            new GameObject("Apex Surge HUD").AddComponent<RenegadeApexSurgeHud>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180 && _surge == null; i++)
            {
                _surge = Object.FindFirstObjectByType<RenegadeApexSurge>();
                yield return null;
            }
        }

        private void OnGUI()
        {
            if (_surge == null) return;
            _label ??= new GUIStyle(GUI.skin.label) { fontSize = 13, fontStyle = FontStyle.Bold };
            _label.normal.textColor = new Color(0.73f, 0.60f, 1f);
            var x = 28f;
            var y = Screen.height - 112f;
            GUI.Label(new Rect(x, y, 220f, 22f), _surge.Active ? "APEX SURGE // ACTIVE" : "APEX CHARGE", _label);
            var old = GUI.color;
            GUI.color = new Color(1f, 1f, 1f, 0.13f);
            GUI.DrawTexture(new Rect(x, y + 25f, 220f, 5f), Texture2D.whiteTexture);
            GUI.color = _surge.Charge.Full ? new Color(0.88f, 0.72f, 1f) : new Color(0.52f, 0.36f, 1f);
            GUI.DrawTexture(new Rect(x, y + 25f, 220f * _surge.Charge.Value, 5f), Texture2D.whiteTexture);
            GUI.color = old;
        }
    }
}
