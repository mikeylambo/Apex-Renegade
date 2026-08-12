using System;
using System.Collections.Generic;
using Apex.Audio;
using Apex.Combat;
using Apex.Input;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeArsenalController : MonoBehaviour
    {
        private Camera _camera;
        private ApexInputService _input;
        private GameObject _source;
        private HealthComponent _sourceHealth;
        private ApexFirstPersonMotor _sourceMotor;
        private ApexBikeMotor _bike;
        private ApexAudioService _audio;
        private ApexWeaponLoadout _loadout;
        private WeaponDefinition _coronaDefinition;
        private WeaponDefinition _mawDefinition;
        private ApexWeaponRuntime _corona;
        private readonly ApexAimAssistResolver _aimAssist = new();
        private readonly List<IAimAssistTarget> _targets = new();
        private readonly Dictionary<ApexWeaponRuntime, Transform> _viewModels = new();
        private readonly Dictionary<ApexWeaponRuntime, Vector3> _viewModelBases = new();
        private Vector3 _recoilPosition;
        private Vector3 _recoilRotation;
        private float _hitmarkerUntil;
        private float _killmarkerUntil;
        private float _muzzleUntil;
        private bool _lastMounted;

        public ApexWeaponLoadout Loadout => _loadout;
        public ApexWeaponRuntime ActiveWeapon => _loadout?.Active;
        public ApexWeaponRuntime BikeWeapon => _corona;
        public ApexWeaponRuntime DisplayWeapon => _bike != null && _bike.IsMounted ? _corona : ActiveWeapon;
        public bool IsAiming => _input != null && (_bike == null || !_bike.IsMounted) && _input.Held(_input.Aim);
        public bool HitmarkerVisible => Time.unscaledTime < _hitmarkerUntil;
        public bool KillmarkerVisible => Time.unscaledTime < _killmarkerUntil;
        public bool MuzzleVisible => Time.unscaledTime < _muzzleUntil;

        public event Action<Vector3, bool> HitConfirmed;
        public event Action<ApexWeaponRuntime> ShotFired;
        public event Action<ApexWeaponRuntime> WeaponChanged;

        public void Configure(Camera camera, ApexInputService input, GameObject source, ApexBikeMotor bike, ApexAudioService audio = null)
        {
            _camera = camera;
            _input = input;
            _source = source;
            _sourceHealth = source != null ? source.GetComponent<HealthComponent>() : null;
            _sourceMotor = source != null ? source.GetComponent<ApexFirstPersonMotor>() : null;
            _bike = bike;
            _audio = audio;

            _coronaDefinition = CreateDefinition(
                "corona-blaster", "Corona Blaster", 18, 126, 8.5f, 1.12f, true,
                1, 0.28f, 220f, 24f, DamageKind.Energy, 73f, 1.15f, 0.30f, 4f);
            _mawDefinition = CreateDefinition(
                "maw", "Maw", 6, 36, 1.15f, 1.58f, false,
                9, 4.7f, 46f, 15f, DamageKind.Ballistic, 77f, 5.2f, 1.15f, 9f);

            _corona = new ApexWeaponRuntime(_coronaDefinition);
            var maw = new ApexWeaponRuntime(_mawDefinition);
            _corona.DryFired += () => _audio?.Play("weapon.dry", 0.62f);
            maw.DryFired += () => _audio?.Play("weapon.dry", 0.72f, ApexAudioBus.Sfx, 0.78f);

            _loadout = new ApexWeaponLoadout();
            _loadout.Add(_corona);
            _loadout.Add(maw, false);
            _loadout.WeaponChanged += (_, weapon) =>
            {
                _audio?.Play("ui.confirm", 0.42f, ApexAudioBus.Sfx, weapon.Definition.weaponId == "maw" ? 0.82f : 1.08f);
                _recoilPosition = Vector3.zero;
                _recoilRotation = Vector3.zero;
                SyncViewModels();
                WeaponChanged?.Invoke(weapon);
            };

            BuildCoronaViewModel(_corona);
            BuildMawViewModel(maw);
            SyncViewModels();
        }

        private static WeaponDefinition CreateDefinition(
            string id, string displayName, int magazine, int reserve, float rps, float reload,
            bool automatic, int pellets, float spread, float range, float damage, DamageKind kind,
            float adsFov, float recoilPitch, float recoilYaw, float impulse)
        {
            var d = ScriptableObject.CreateInstance<WeaponDefinition>();
            d.weaponId = id;
            d.displayName = displayName;
            d.magazineSize = magazine;
            d.startingReserve = reserve;
            d.roundsPerSecond = rps;
            d.reloadDuration = reload;
            d.automatic = automatic;
            d.pellets = pellets;
            d.spreadDegrees = spread;
            d.range = range;
            d.damage = damage;
            d.damageKind = kind;
            d.adsFov = adsFov;
            d.recoilPitch = recoilPitch;
            d.recoilYaw = recoilYaw;
            d.hitImpulse = impulse;
            d.Sanitize();
            return d;
        }

        public void RegisterTarget(IAimAssistTarget target)
        {
            if (target == null || _targets.Contains(target)) return;
            _targets.Add(target);
            _aimAssist.Register(target);
        }

        public void UnregisterTarget(IAimAssistTarget target)
        {
            if (target == null) return;
            _targets.Remove(target);
            _aimAssist.Unregister(target);
        }

        public int AddAmmo(string weaponId, int amount) => _loadout?.AddAmmo(weaponId, amount) ?? 0;

        private void Update()
        {
            if (Time.timeScale <= 0f || _loadout == null || _input == null || _camera == null) return;
            var dt = Time.deltaTime;
            _loadout.Tick(dt);

            var mounted = _bike != null && _bike.IsMounted;
            if (mounted != _lastMounted)
            {
                _lastMounted = mounted;
                SyncViewModels();
            }

            if (!mounted)
            {
                if (_input.Pressed(_input.WeaponNext)) _loadout.EquipNext();
                else if (_input.Pressed(_input.WeaponPrevious)) _loadout.EquipPrevious();
            }

            if (_sourceHealth == null || !_sourceHealth.IsAlive)
            {
                UpdateViewModel(dt);
                return;
            }

            var weapon = mounted ? _corona : _loadout.Active;
            if (weapon == null) return;
            var fireAction = mounted ? _input.BikeFire : _input.Fire;
            var wantsFire = weapon.Definition.automatic ? _input.Held(fireAction) : _input.Pressed(fireAction);
            if (wantsFire) weapon.TryFire();
            if (_input.Pressed(_input.Reload))
            {
                if (weapon.TryReload()) _audio?.Play("weapon.reload", 0.6f, ApexAudioBus.Sfx, weapon.Definition.weaponId == "maw" ? 0.82f : 1f);
            }

            UpdateViewModel(dt);
        }

        private void OnEnable()
        {
            // Weapon runtime events are connected lazily because Configure owns the definitions.
        }

        private void FireShot(ApexWeaponRuntime weapon)
        {
            var d = weapon.Definition;
            var origin = _camera.transform.position;
            var baseForward = _camera.transform.forward;
            if (IsAiming && _input.UsingGamepad && _aimAssist.TryResolve(origin, baseForward, out var solution))
            {
                var assist = Mathf.Clamp01(solution.Strength * 0.24f);
                baseForward = Vector3.Slerp(baseForward, solution.Direction, assist).normalized;
            }

            _muzzleUntil = Time.unscaledTime + (d.pellets > 1 ? 0.075f : 0.045f);
            _recoilRotation += new Vector3(-d.recoilPitch, UnityEngine.Random.Range(-d.recoilYaw, d.recoilYaw), 0f);
            _recoilPosition += new Vector3(0f, d.pellets > 1 ? 0.012f : 0.005f, d.pellets > 1 ? -0.14f : -0.065f);
            _audio?.Play(d.weaponId == "maw" ? "weapon.maw" : "weapon.corona", d.weaponId == "maw" ? 0.95f : 0.72f);
            ShotFired?.Invoke(weapon);

            var anyHit = false;
            var anyKill = false;
            for (var pellet = 0; pellet < d.pellets; pellet++)
            {
                var spread = IsAiming ? d.spreadDegrees * 0.48f : d.spreadDegrees;
                var random = UnityEngine.Random.insideUnitCircle * Mathf.Tan(spread * Mathf.Deg2Rad);
                var direction = (baseForward + _camera.transform.right * random.x + _camera.transform.up * random.y).normalized;
                if (!Physics.Raycast(origin, direction, out var hit, d.range, ~0, QueryTriggerInteraction.Ignore)) continue;

                var damageable = hit.collider.GetComponentInParent<HealthComponent>();
                var reactive = hit.collider.GetComponentInParent<IRenegadeHitReactive>();
                var wasAlive = damageable != null && damageable.IsAlive;
                if (damageable != null && damageable != _sourceHealth)
                {
                    damageable.ApplyDamage(new DamagePayload(d.damage, hit.point, direction, d.damageKind, _source));
                    var killed = wasAlive && !damageable.IsAlive;
                    anyHit = true;
                    anyKill |= killed;
                    HitConfirmed?.Invoke(hit.point, killed);
                }

                if (hit.rigidbody != null && !hit.rigidbody.isKinematic)
                    hit.rigidbody.AddForceAtPosition(direction * d.hitImpulse, hit.point, ForceMode.Impulse);
                reactive?.NotifyHit(hit.point, direction);
            }

            if (anyHit)
            {
                _hitmarkerUntil = Time.unscaledTime + 0.11f;
                _audio?.Play(anyKill ? "combat.kill" : "combat.hit", anyKill ? 0.75f : 0.45f);
            }
            if (anyKill) _killmarkerUntil = Time.unscaledTime + 0.22f;
        }

        private void BuildCoronaViewModel(ApexWeaponRuntime weapon)
        {
            var root = CreateViewModelRoot(weapon, "Corona Blaster Viewmodel", new Vector3(0.34f, -0.31f, 0.62f), new Vector3(1.5f, -4f, 0f));
            var graphite = ApexPortMaterialFactory.Create("Corona Graphite", new Color(0.025f, 0.028f, 0.036f), 0.82f);
            var violet = ApexPortMaterialFactory.Create("Corona Spectral", new Color(0.16f, 0.09f, 0.38f), 0.38f, new Color(0.38f, 0.18f, 1f));
            var pale = ApexPortMaterialFactory.Create("Corona Heat", new Color(0.36f, 0.42f, 0.48f), 0.72f, new Color(0.12f, 0.2f, 0.34f));
            CreatePart(root, "Receiver", new Vector3(0f, 0f, 0.10f), new Vector3(0.18f, 0.16f, 0.48f), graphite);
            CreatePart(root, "Upper Rail", new Vector3(0f, 0.105f, 0.12f), new Vector3(0.09f, 0.055f, 0.56f), pale);
            CreatePart(root, "Spectral Channel", new Vector3(0f, 0.015f, 0.38f), new Vector3(0.055f, 0.07f, 0.56f), violet);
            CreatePart(root, "Grip", new Vector3(0f, -0.16f, -0.02f), new Vector3(0.13f, 0.28f, 0.15f), graphite, new Vector3(15f, 0f, 0f));
            CreatePart(root, "Muzzle", new Vector3(0f, 0.01f, 0.72f), new Vector3(0.14f, 0.13f, 0.14f), pale);
        }

        private void BuildMawViewModel(ApexWeaponRuntime weapon)
        {
            var root = CreateViewModelRoot(weapon, "Maw Viewmodel", new Vector3(0.38f, -0.36f, 0.72f), new Vector3(2f, -5f, 0f));
            var dark = ApexPortMaterialFactory.Create("Maw Graphite", new Color(0.03f, 0.025f, 0.025f), 0.78f);
            var bone = ApexPortMaterialFactory.Create("Maw Pale", new Color(0.28f, 0.30f, 0.30f), 0.55f);
            var heat = ApexPortMaterialFactory.Create("Maw Heat", new Color(0.28f, 0.10f, 0.045f), 0.30f, new Color(0.9f, 0.18f, 0.035f));
            CreatePart(root, "Core", new Vector3(0f, 0f, 0.18f), new Vector3(0.25f, 0.22f, 0.82f), dark);
            CreatePart(root, "Top Spine", new Vector3(0f, 0.14f, 0.22f), new Vector3(0.13f, 0.08f, 0.92f), bone);
            CreatePart(root, "Maw Left", new Vector3(-0.12f, 0.015f, 0.72f), new Vector3(0.09f, 0.14f, 0.42f), heat, new Vector3(0f, -7f, 0f));
            CreatePart(root, "Maw Right", new Vector3(0.12f, 0.015f, 0.72f), new Vector3(0.09f, 0.14f, 0.42f), heat, new Vector3(0f, 7f, 0f));
            CreatePart(root, "Grip", new Vector3(0f, -0.20f, -0.02f), new Vector3(0.16f, 0.34f, 0.18f), dark, new Vector3(13f, 0f, 0f));
        }

        private Transform CreateViewModelRoot(ApexWeaponRuntime weapon, string name, Vector3 position, Vector3 euler)
        {
            var root = new GameObject(name).transform;
            root.SetParent(_camera.transform, false);
            root.localPosition = position;
            root.localRotation = Quaternion.Euler(euler);
            _viewModels[weapon] = root;
            _viewModelBases[weapon] = position;
            weapon.Fired += FireShot;
            return root;
        }

        private void SyncViewModels()
        {
            var mounted = _bike != null && _bike.IsMounted;
            foreach (var pair in _viewModels)
                if (pair.Value != null) pair.Value.gameObject.SetActive(!mounted && pair.Key == _loadout.Active);
        }

        private void UpdateViewModel(float dt)
        {
            var weapon = ActiveWeapon;
            if (weapon == null || !_viewModels.TryGetValue(weapon, out var root) || root == null || !root.gameObject.activeSelf) return;
            _recoilPosition = Vector3.Lerp(_recoilPosition, Vector3.zero, 1f - Mathf.Exp(-18f * dt));
            _recoilRotation = Vector3.Lerp(_recoilRotation, Vector3.zero, 1f - Mathf.Exp(-15f * dt));
            var basePosition = _viewModelBases[weapon];
            var speed = _sourceMotor != null ? Vector3.ProjectOnPlane(_sourceMotor.Velocity, Vector3.up).magnitude : 0f;
            var move01 = Mathf.Clamp01(speed / 8f);
            var bobPhase = Time.time * Mathf.Lerp(5.5f, 9.5f, move01);
            var bob = IsAiming ? Vector3.zero : new Vector3(Mathf.Sin(bobPhase) * 0.012f, Mathf.Abs(Mathf.Cos(bobPhase)) * 0.010f, 0f) * move01;
            var ads = IsAiming ? new Vector3(-basePosition.x, -basePosition.y - 0.02f, -0.08f) : Vector3.zero;
            root.localPosition = Vector3.Lerp(root.localPosition, basePosition + ads + bob + _recoilPosition, 1f - Mathf.Exp(-(IsAiming ? 16f : 12f) * dt));
            var bobRoll = IsAiming ? 0f : Mathf.Sin(bobPhase * 0.5f) * 0.55f * move01;
            root.localRotation = Quaternion.Slerp(root.localRotation, Quaternion.Euler(_recoilRotation + (IsAiming ? Vector3.zero : new Vector3(1.5f, -4f, bobRoll))), 1f - Mathf.Exp(-16f * dt));
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

        private void OnDestroy()
        {
            foreach (var pair in _viewModels)
                if (pair.Key != null) pair.Key.Fired -= FireShot;
            if (_coronaDefinition != null) Destroy(_coronaDefinition);
            if (_mawDefinition != null) Destroy(_mawDefinition);
        }
    }
}
