using System;
using System.Collections;
using System.Collections.Generic;
using Apex.Combat;
using Apex.Input;
using Apex.Save;
using Apex.Traversal;
using Apex.World;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeWeaponController : MonoBehaviour
    {
        private Camera _camera;
        private ApexInputService _input;
        private GameObject _source;
        private HealthComponent _sourceHealth;
        private ApexBikeMotor _bike;
        private WeaponDefinition _definition;
        private ApexWeaponRuntime _weapon;
        private readonly ApexAimAssistResolver _aimAssist = new();
        private readonly List<ApexPortEnemy> _targets = new();
        private Transform _viewModel;
        private Vector3 _viewModelBasePosition;
        private Vector3 _recoilPosition;
        private Vector3 _recoilRotation;
        private bool _lastMounted;
        private float _hitmarkerUntil;
        private float _killmarkerUntil;
        private float _muzzleUntil;

        public ApexWeaponRuntime Weapon => _weapon;
        public bool IsAiming => _input != null && (_bike == null || !_bike.IsMounted) && _input.Held(_input.Aim);
        public bool HitmarkerVisible => Time.unscaledTime < _hitmarkerUntil;
        public bool KillmarkerVisible => Time.unscaledTime < _killmarkerUntil;
        public bool MuzzleVisible => Time.unscaledTime < _muzzleUntil;
        public event Action<Vector3, bool> HitConfirmed;

        public void Configure(Camera camera, ApexInputService input, GameObject source, ApexBikeMotor bike)
        {
            _camera = camera;
            _input = input;
            _source = source;
            _sourceHealth = source != null ? source.GetComponent<HealthComponent>() : null;
            _bike = bike;

            _definition = ScriptableObject.CreateInstance<WeaponDefinition>();
            _definition.weaponId = "corona-blaster";
            _definition.displayName = "Corona Blaster";
            _definition.magazineSize = 18;
            _definition.startingReserve = 126;
            _definition.roundsPerSecond = 8.5f;
            _definition.reloadDuration = 1.12f;
            _definition.automatic = true;
            _definition.pellets = 1;
            _definition.spreadDegrees = 0.28f;
            _definition.range = 220f;
            _definition.damage = 24f;
            _definition.damageKind = DamageKind.Energy;
            _definition.adsFov = 73f;
            _definition.recoilPitch = 1.15f;
            _definition.recoilYaw = 0.30f;
            _definition.hitImpulse = 4f;
            _definition.Sanitize();

            _weapon = new ApexWeaponRuntime(_definition);
            _weapon.Equip();
            BuildViewModel();
        }

        public void RegisterTarget(ApexPortEnemy enemy)
        {
            if (enemy == null || _targets.Contains(enemy)) return;
            _targets.Add(enemy);
            _aimAssist.Register(enemy);
        }

        public void UnregisterTarget(ApexPortEnemy enemy)
        {
            if (enemy == null) return;
            _targets.Remove(enemy);
            _aimAssist.Unregister(enemy);
        }

        private void Update()
        {
            if (_weapon == null || _input == null || _camera == null) return;
            var dt = Time.deltaTime;
            _weapon.Tick(dt);

            var mounted = _bike != null && _bike.IsMounted;
            if (mounted != _lastMounted)
            {
                _lastMounted = mounted;
                if (_viewModel != null) _viewModel.gameObject.SetActive(!mounted);
            }

            if (_sourceHealth == null || !_sourceHealth.IsAlive)
            {
                UpdateViewModel(dt);
                return;
            }

            var fireAction = mounted ? _input.BikeFire : _input.Fire;
            var wantsFire = _definition.automatic ? _input.Held(fireAction) : _input.Pressed(fireAction);
            if (wantsFire && _weapon.TryFire()) FireShot();
            if (_input.Pressed(_input.Reload)) _weapon.TryReload();

            UpdateViewModel(dt);
        }

        private void FireShot()
        {
            var origin = _camera.transform.position;
            var forward = _camera.transform.forward;
            if (IsAiming && _input.UsingGamepad && _aimAssist.TryResolve(origin, forward, out var solution))
            {
                var assist = Mathf.Clamp01(solution.Strength * 0.24f);
                forward = Vector3.Slerp(forward, solution.Direction, assist).normalized;
            }

            var spread = IsAiming ? _definition.spreadDegrees * 0.42f : _definition.spreadDegrees;
            var random = UnityEngine.Random.insideUnitCircle * Mathf.Tan(spread * Mathf.Deg2Rad);
            var direction = (forward + _camera.transform.right * random.x + _camera.transform.up * random.y).normalized;

            _muzzleUntil = Time.unscaledTime + 0.045f;
            _recoilRotation += new Vector3(-_definition.recoilPitch, UnityEngine.Random.Range(-_definition.recoilYaw, _definition.recoilYaw), 0f);
            _recoilPosition += new Vector3(0f, 0.005f, -0.065f);

            if (!Physics.Raycast(origin, direction, out var hit, _definition.range, ~0, QueryTriggerInteraction.Ignore)) return;
            var damageable = hit.collider.GetComponentInParent<HealthComponent>();
            var enemy = hit.collider.GetComponentInParent<ApexPortEnemy>();
            var wasAlive = damageable != null && damageable.IsAlive;
            if (damageable != null)
            {
                damageable.ApplyDamage(new DamagePayload(_definition.damage, hit.point, direction, _definition.damageKind, _source));
                var killed = wasAlive && !damageable.IsAlive;
                _hitmarkerUntil = Time.unscaledTime + 0.11f;
                if (killed) _killmarkerUntil = Time.unscaledTime + 0.22f;
                HitConfirmed?.Invoke(hit.point, killed);
            }

            if (hit.rigidbody != null && !hit.rigidbody.isKinematic)
                hit.rigidbody.AddForceAtPosition(direction * _definition.hitImpulse, hit.point, ForceMode.Impulse);

            if (enemy != null) enemy.NotifyHit(hit.point, direction);
        }

        private void BuildViewModel()
        {
            if (_camera == null) return;
            var root = new GameObject("Corona Blaster Viewmodel").transform;
            root.SetParent(_camera.transform, false);
            root.localPosition = new Vector3(0.34f, -0.31f, 0.62f);
            root.localRotation = Quaternion.Euler(1.5f, -4f, 0f);
            _viewModel = root;
            _viewModelBasePosition = root.localPosition;

            var graphite = CreateMaterial("Corona Graphite", new Color(0.025f, 0.028f, 0.036f), 0.82f, Color.black);
            var violet = CreateMaterial("Corona Spectral", new Color(0.16f, 0.09f, 0.38f), 0.38f, new Color(0.38f, 0.18f, 1f));
            var pale = CreateMaterial("Corona Heat", new Color(0.36f, 0.42f, 0.48f), 0.72f, new Color(0.12f, 0.2f, 0.34f));

            CreatePart(root, "Receiver", new Vector3(0f, 0f, 0.10f), new Vector3(0.18f, 0.16f, 0.48f), graphite);
            CreatePart(root, "Upper Rail", new Vector3(0f, 0.105f, 0.12f), new Vector3(0.09f, 0.055f, 0.56f), pale);
            CreatePart(root, "Spectral Channel", new Vector3(0f, 0.015f, 0.38f), new Vector3(0.055f, 0.07f, 0.56f), violet);
            CreatePart(root, "Grip", new Vector3(0f, -0.16f, -0.02f), new Vector3(0.13f, 0.28f, 0.15f), graphite, new Vector3(15f, 0f, 0f));
            CreatePart(root, "Muzzle", new Vector3(0f, 0.01f, 0.72f), new Vector3(0.14f, 0.13f, 0.14f), pale);
        }

        private void UpdateViewModel(float dt)
        {
            if (_viewModel == null || !_viewModel.gameObject.activeSelf) return;
            _recoilPosition = Vector3.Lerp(_recoilPosition, Vector3.zero, 1f - Mathf.Exp(-18f * dt));
            _recoilRotation = Vector3.Lerp(_recoilRotation, Vector3.zero, 1f - Mathf.Exp(-15f * dt));
            var ads = IsAiming ? new Vector3(-0.34f, 0.29f, -0.07f) : Vector3.zero;
            var target = _viewModelBasePosition + ads + _recoilPosition;
            _viewModel.localPosition = Vector3.Lerp(_viewModel.localPosition, target, 1f - Mathf.Exp(-(IsAiming ? 16f : 12f) * dt));
            _viewModel.localRotation = Quaternion.Slerp(_viewModel.localRotation, Quaternion.Euler(_recoilRotation + (IsAiming ? new Vector3(0f, 4f, 0f) : new Vector3(1.5f, -4f, 0f))), 1f - Mathf.Exp(-16f * dt));
        }

        private static void CreatePart(Transform parent, string name, Vector3 localPosition, Vector3 scale, Material material, Vector3 euler = default)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            go.transform.localRotation = Quaternion.Euler(euler);
            go.transform.localScale = scale;
            if (go.TryGetComponent<Renderer>(out var renderer)) renderer.sharedMaterial = material;
            if (go.TryGetComponent<Collider>(out var collider)) Destroy(collider);
        }

        private static Material CreateMaterial(string name, Color color, float metallic, Color emission)
        {
            var shader = Shader.Find("Standard") ?? Shader.Find("Unlit/Color");
            var mat = new Material(shader) { name = name, color = color };
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", metallic);
            if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", 0.46f);
            if (mat.HasProperty("_EmissionColor") && emission.maxColorComponent > 0f)
            {
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", emission);
            }
            return mat;
        }

        private void OnDestroy()
        {
            if (_definition != null) Destroy(_definition);
        }
    }

    [RequireComponent(typeof(CharacterController), typeof(HealthComponent))]
    public sealed class ApexPortEnemy : MonoBehaviour, IAimAssistTarget
    {
        private CharacterController _controller;
        private HealthComponent _health;
        private Transform _target;
        private Material _material;
        private Color _baseColor;
        private float _attackTimer;
        private float _flashUntil;
        private float _stagger;
        private Vector3 _staggerDirection;

        public bool AimAssistEligible => _health != null && _health.IsAlive && isActiveAndEnabled;
        public Vector3 AimAssistPoint => transform.position + Vector3.up * 1.25f;
        public float AimAssistPriority => 0.75f;
        public HealthComponent Health => _health;

        public event Action<ApexPortEnemy> Killed;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            _health = GetComponent<HealthComponent>();
            _health.Died += OnDied;
            _health.Damaged += OnDamaged;
        }

        public void Configure(Transform target, float health, Material material)
        {
            _target = target;
            _health.Configure(health, 0f);
            _material = material;
            if (_material != null) _baseColor = _material.color;
        }

        private void Update()
        {
            if (_health == null || !_health.IsAlive || _target == null) return;
            var dt = Time.deltaTime;
            var to = _target.position - transform.position;
            var planar = Vector3.ProjectOnPlane(to, Vector3.up);
            var distance = planar.magnitude;

            if (planar.sqrMagnitude > 0.01f)
            {
                var targetRotation = Quaternion.LookRotation(planar.normalized, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, 1f - Mathf.Exp(-7f * dt));
            }

            if (_stagger > 0f)
            {
                _controller.Move(_staggerDirection * (_stagger * dt));
                _stagger = Mathf.Max(0f, _stagger - 18f * dt);
            }
            else if (distance > 8.5f && distance < 85f)
            {
                _controller.Move(planar.normalized * (4.1f * dt));
            }

            _attackTimer -= dt;
            if (distance <= 13f && _attackTimer <= 0f)
            {
                _attackTimer = 0.92f;
                var targetHealth = _target.GetComponent<HealthComponent>();
                if (targetHealth != null && targetHealth.IsAlive)
                {
                    var point = _target.position + Vector3.up * 1.1f;
                    targetHealth.ApplyDamage(new DamagePayload(8f, point, planar.sqrMagnitude > 0.001f ? planar.normalized : transform.forward, DamageKind.Energy, gameObject));
                }
            }

            if (_material != null && Time.unscaledTime >= _flashUntil && _material.color != _baseColor)
                _material.color = _baseColor;
        }

        public void NotifyHit(Vector3 point, Vector3 direction)
        {
            _stagger = Mathf.Min(6f, _stagger + 2.4f);
            _staggerDirection = direction;
        }

        private void OnDamaged(DamagePayload payload, float health, float shield)
        {
            if (_material == null) return;
            _material.color = Color.Lerp(_baseColor, Color.white, 0.72f);
            _flashUntil = Time.unscaledTime + 0.055f;
        }

        private void OnDied()
        {
            if (_controller != null) _controller.enabled = false;
            Killed?.Invoke(this);
            StartCoroutine(DeathRoutine());
        }

        private IEnumerator DeathRoutine()
        {
            var start = transform.localScale;
            var elapsed = 0f;
            while (elapsed < 0.45f)
            {
                elapsed += Time.deltaTime;
                var t = Mathf.Clamp01(elapsed / 0.45f);
                transform.localScale = new Vector3(start.x * (1f + t * 0.18f), start.y * (1f - t * 0.92f), start.z * (1f + t * 0.18f));
                yield return null;
            }
            gameObject.SetActive(false);
        }
    }

    public sealed class RenegadeLifeCycle : MonoBehaviour
    {
        private HealthComponent _health;
        private ApexFirstPersonMotor _motor;
        private ApexSaveService _save;
        private ApexBikeMotor _bike;
        private bool _respawning;
        public float LastDamageTime { get; private set; } = -10f;
        public Vector3 LastDamageDirection { get; private set; }
        public bool IsRespawning => _respawning;

        public void Configure(HealthComponent health, ApexFirstPersonMotor motor, ApexSaveService save, ApexBikeMotor bike)
        {
            _health = health;
            _motor = motor;
            _save = save;
            _bike = bike;
            _health.Died += OnDied;
            _health.Damaged += OnDamaged;
        }

        private void OnDamaged(DamagePayload payload, float health, float shield)
        {
            LastDamageTime = Time.unscaledTime;
            LastDamageDirection = payload.Direction;
        }

        private void OnDied()
        {
            if (!_respawning) StartCoroutine(RespawnRoutine());
        }

        private IEnumerator RespawnRoutine()
        {
            _respawning = true;
            if (_bike != null && _bike.IsMounted) _bike.Dismount();
            if (_motor != null) _motor.enabled = false;
            yield return new WaitForSecondsRealtime(1.15f);

            if (_save != null && _save.TryGetRespawn(out var position, out var rotation))
                _motor.Teleport(position, rotation);
            else
                _motor.Teleport(new Vector3(0f, 2.2f, 525f), Quaternion.identity);

            _health.ResetVitals();
            if (_motor != null) _motor.enabled = true;
            _respawning = false;
        }
    }

    public sealed class ApexPortHud : MonoBehaviour
    {
        private HealthComponent _health;
        private RenegadeWeaponController _weapon;
        private ApexBikeMotor _bike;
        private ApexWorldRegionTracker _regions;
        private RenegadeLifeCycle _life;
        private Camera _camera;
        private GUIStyle _small;
        private GUIStyle _large;
        private GUIStyle _damage;

        public void Configure(HealthComponent health, RenegadeWeaponController weapon, ApexBikeMotor bike, ApexWorldRegionTracker regions, RenegadeLifeCycle life, Camera camera)
        {
            _health = health;
            _weapon = weapon;
            _bike = bike;
            _regions = regions;
            _life = life;
            _camera = camera;
        }

        private void OnGUI()
        {
            if (_health == null || _weapon == null || _weapon.Weapon == null) return;
            EnsureStyles();
            var w = Screen.width;
            var h = Screen.height;
            var cx = w * 0.5f;
            var cy = h * 0.5f;

            GUI.color = new Color(0.72f, 0.82f, 1f, 0.88f);
            DrawRect(new Rect(cx - 10f, cy - 1f, 7f, 2f));
            DrawRect(new Rect(cx + 3f, cy - 1f, 7f, 2f));
            DrawRect(new Rect(cx - 1f, cy - 10f, 2f, 7f));
            DrawRect(new Rect(cx - 1f, cy + 3f, 2f, 7f));

            if (_weapon.HitmarkerVisible)
            {
                GUI.color = _weapon.KillmarkerVisible ? new Color(1f, 0.72f, 0.28f, 1f) : Color.white;
                var oldMatrix = GUI.matrix;
                GUIUtility.RotateAroundPivot(45f, new Vector2(cx, cy));
                DrawRect(new Rect(cx - 9f, cy - 1f, 18f, 2f));
                DrawRect(new Rect(cx - 1f, cy - 9f, 2f, 18f));
                GUI.matrix = oldMatrix;
            }

            GUI.color = Color.white;
            GUI.Label(new Rect(28f, h - 76f, 360f, 28f), $"HP {Mathf.CeilToInt(_health.Health):000}   SH {Mathf.CeilToInt(_health.Shield):000}", _large);
            GUI.Label(new Rect(w - 330f, h - 82f, 300f, 30f), $"{_weapon.Weapon.Definition.displayName}   {_weapon.Weapon.Magazine:00} / {_weapon.Weapon.Reserve:000}", _large);
            GUI.Label(new Rect(28f, 24f, 420f, 24f), string.IsNullOrWhiteSpace(_regions?.ActiveRegion) ? "APEX // TRANSIT" : $"APEX // {_regions.ActiveRegion.ToUpperInvariant()}", _small);

            if (_weapon.Weapon.State == WeaponState.Reloading)
                GUI.Label(new Rect(w - 330f, h - 50f, 300f, 24f), "RELOADING", _small);

            if (_bike != null)
            {
                var bikeText = _bike.IsMounted
                    ? $"BIKE  {Mathf.Abs(_bike.Speed) * 3.6f:000} km/h   DRIVE {_bike.BoostEnergy:000}   RB FIRE"
                    : (_bike.IsRecalling ? "BIKE // RECALLING" : "D-PAD ↓ / V // MOUNT / RECALL");
                GUI.Label(new Rect(28f, h - 42f, 560f, 24f), bikeText, _small);
            }

            DrawDamageFeedback(w, h);

            if (_life != null && _life.IsRespawning)
            {
                GUI.color = new Color(0f, 0f, 0f, 0.7f);
                GUI.DrawTexture(new Rect(0f, 0f, w, h), Texture2D.whiteTexture);
                GUI.color = Color.white;
                GUI.Label(new Rect(cx - 170f, cy - 20f, 340f, 40f), "RECONSTITUTING // CHECKPOINT", _large);
            }
        }

        private void DrawDamageFeedback(float w, float h)
        {
            if (_life == null) return;
            var age = Time.unscaledTime - _life.LastDamageTime;
            if (age >= 0.38f) return;

            GUI.color = new Color(1f, 0.18f, 0.12f, 0.23f * (1f - age / 0.38f));
            GUI.DrawTexture(new Rect(0f, 0f, w, h), Texture2D.whiteTexture);
            GUI.color = Color.white;

            if (_camera == null) return;
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

        private void EnsureStyles()
        {
            if (_small != null) return;
            _small = new GUIStyle(GUI.skin.label) { fontSize = 15, fontStyle = FontStyle.Bold };
            _small.normal.textColor = new Color(0.75f, 0.84f, 0.96f);
            _large = new GUIStyle(_small) { fontSize = 19 };
            _damage = new GUIStyle(_large) { fontSize = 34, alignment = TextAnchor.MiddleCenter };
            _damage.normal.textColor = new Color(1f, 0.32f, 0.22f);
        }

        private static void DrawRect(Rect rect) => GUI.DrawTexture(rect, Texture2D.whiteTexture);
    }
}
