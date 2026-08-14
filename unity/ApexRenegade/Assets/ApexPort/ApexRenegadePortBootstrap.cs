using Apex.Audio;
using Apex.Combat;
using Apex.Core;
using Apex.Debugging;
using Apex.Encounter;
using Apex.Input;
using Apex.Interaction;
using Apex.Save;
using Apex.Settings;
using Apex.Traversal;
using Apex.World;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-1000)]
    public sealed class ApexRenegadePortBootstrap : MonoBehaviour
    {
        private ApexSettingsService _settings;
        private ApexSaveService _save;
        private ApexInputService _input;
        private ApexAudioService _audio;
        private ApexTelemetry _telemetry;
        private ApexFirstPersonMotor _player;
        private HealthComponent _playerHealth;
        private ApexBikeMotor _bike;
        private Camera _mainCamera;
        private ApexPortCameraV2 _cameraRig;
        private ApexWorldRegionTracker _regions;
        private RenegadeArsenalController _arsenal;
        private RenegadeLifeCycle _lifeCycle;
        private ApexInteractionScanner _scanner;
        private RenegadeEscalationDirector _escalation;
        private RenegadeEncounterSpawner _encounterSpawner;
        private ApexEncounterController _encounter;
        private EncounterDefinition _encounterDefinition;

        public RenegadeArsenalController Arsenal => _arsenal;
        public ApexBikeMotor Bike => _bike;
        public ApexEncounterController Encounter => _encounter;
        public RenegadeEscalationDirector Escalation => _escalation;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureBootstrap()
        {
            if (Object.FindFirstObjectByType<ApexRenegadePortBootstrap>() != null) return;
            new GameObject("Apex Renegade // Unity Port Bootstrap").AddComponent<ApexRenegadePortBootstrap>();
        }

        private void Awake()
        {
            DontDestroyOnLoad(gameObject);
            ApexRuntime.Initialize();

            _settings = new ApexSettingsService();
            _settings.Initialize(ApexRuntime.Services);

            _save = new ApexSaveService();
            _save.Initialize(ApexRuntime.Services);

            var inputObject = new GameObject("Apex Input Service");
            inputObject.transform.SetParent(transform);
            _input = inputObject.AddComponent<ApexInputService>();
            _input.Initialize(ApexRuntime.Services);

            var audioObject = new GameObject("Apex Audio Service");
            audioObject.transform.SetParent(transform);
            _audio = audioObject.AddComponent<ApexAudioService>();
            _audio.Initialize(ApexRuntime.Services);

            _telemetry = gameObject.AddComponent<ApexTelemetry>();

            BuildWorld();
            BuildPlayer();
            BuildBike();
            BuildCamera();
            BuildCombat();
            BuildInteractions();
            BuildCheckpoints();
            BuildEncounter();
            BuildHud();

            if (!_save.HasCheckpoint)
                _save.SetCheckpoint("scar-entry", "The Scar", _player.transform.position, _player.transform.rotation);

            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }

        private void Update()
        {
            if (_input == null || _player == null || _bike == null) return;

            if (_input.Pressed(_input.Bike))
            {
                if (_bike.IsMounted) _bike.Dismount();
                else if (_bike.CanMount(_player.transform)) _bike.Mount(_player);
                else _bike.Recall();
            }

            if (_regions != null)
                _regions.SetObserver(_bike.IsMounted ? _bike.transform : _player.transform);
        }

        private void BuildWorld()
        {
            if (GameObject.Find("Apex Port World") != null) return;
            var world = new GameObject("Apex Port World");

            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.035f, 0.065f, 0.10f);
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.0009f;
            RenderSettings.ambientLight = new Color(0.16f, 0.19f, 0.23f);

            var lightObject = new GameObject("World Sun");
            lightObject.transform.SetParent(world.transform);
            lightObject.transform.rotation = Quaternion.Euler(36f, -28f, 0f);
            var sun = lightObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.15f;
            sun.color = new Color(0.78f, 0.86f, 1f);
            sun.shadows = LightShadows.Soft;

            var groundMat = ApexPortMaterialFactory.Create("Ground", new Color(0.12f, 0.14f, 0.15f), 0.15f);
            var roadMat = ApexPortMaterialFactory.Create("Road", new Color(0.055f, 0.065f, 0.07f), 0.05f);
            var cityMat = ApexPortMaterialFactory.Create("City", new Color(0.07f, 0.09f, 0.12f), 0.3f);
            var paleMat = ApexPortMaterialFactory.Create("Containment Pale", new Color(0.25f, 0.31f, 0.36f), 0.5f, new Color(0.035f, 0.07f, 0.12f));
            var amberMat = ApexPortMaterialFactory.Create("Containment Amber", new Color(0.21f, 0.09f, 0.025f), 0.3f, new Color(0.85f, 0.22f, 0.025f));

            CreateBlock(world.transform, "Scar Ground", new Vector3(0f, -2f, 250f), new Vector3(1600f, 4f, 1500f), groundMat, true);
            CreateBlock(world.transform, "Expanse Ground", new Vector3(0f, -2f, -1550f), new Vector3(2000f, 4f, 2200f), groundMat, true);
            CreateBlock(world.transform, "Vertical Ground", new Vector3(0f, -2f, -3700f), new Vector3(2400f, 4f, 2400f), groundMat, true);
            CreateBlock(world.transform, "World Spine Road", new Vector3(0f, 0.02f, -1800f), new Vector3(54f, 0.08f, 5600f), roadMat, false);

            for (var i = 0; i < 18; i++)
            {
                var side = i % 2 == 0 ? -1f : 1f;
                var z = 500f - i * 90f;
                var height = 45f + (i % 5) * 28f;
                CreateBlock(world.transform, $"Scar Mass {i:00}", new Vector3(side * (125f + (i % 4) * 45f), height * 0.5f, z), new Vector3(60f + (i % 3) * 25f, height, 70f), cityMat, true);
            }

            // The first Unity hero landmark: a containment gantry that makes The Scar readable from distance.
            CreateBlock(world.transform, "Scar Containment Gantry", new Vector3(0f, 36f, 40f), new Vector3(185f, 8f, 14f), cityMat, true);
            CreateBlock(world.transform, "Scar Gantry Left", new Vector3(-82f, 18f, 40f), new Vector3(12f, 36f, 18f), cityMat, true);
            CreateBlock(world.transform, "Scar Gantry Right", new Vector3(82f, 18f, 40f), new Vector3(12f, 36f, 18f), cityMat, true);
            for (var i = 0; i < 7; i++)
                CreateBlock(world.transform, $"Gantry Light {i}", new Vector3(-60f + i * 20f, 31f, 32.5f), new Vector3(6f, 1.2f, 0.8f), i % 3 == 0 ? amberMat : paleMat, false);

            for (var i = 0; i < 20; i++)
            {
                var side = i % 2 == 0 ? -1f : 1f;
                var x = side * (180f + (i % 5) * 90f);
                var z = -900f - (i / 2) * 175f;
                var hill = CreateBlock(world.transform, $"Expanse Mass {i:00}", new Vector3(x, 18f + (i % 3) * 8f, z), new Vector3(160f + (i % 4) * 45f, 35f + (i % 3) * 18f, 190f), groundMat, true);
                hill.transform.rotation = Quaternion.Euler(0f, (i * 17f) % 38f - 19f, (i % 2 == 0 ? 1f : -1f) * 5f);
            }

            for (var i = 0; i < 32; i++)
            {
                var side = i % 2 == 0 ? -1f : 1f;
                var lane = 180f + (i % 6) * 95f;
                var z = -2900f - (i / 2) * 135f;
                var height = 160f + (i % 8) * 85f;
                CreateBlock(world.transform, $"Vertical Megablock {i:00}", new Vector3(side * lane, height * 0.5f, z), new Vector3(85f + (i % 4) * 30f, height, 95f + (i % 3) * 45f), cityMat, true);
            }

            // Suspended silhouettes provide a first-pass vertical canyon without committing to final art.
            for (var i = 0; i < 5; i++)
            {
                var y = 110f + i * 92f;
                var z = -3150f - i * 190f;
                CreateBlock(world.transform, $"Vertical Suspended Span {i:00}", new Vector3(0f, y, z), new Vector3(300f + i * 45f, 12f, 34f), cityMat, true);
            }

            var regionObjects = new ApexRegionVolume[3];
            regionObjects[0] = CreateRegion(world.transform, "The Scar", new Vector3(0f, 250f, 250f), new Vector3(1800f, 600f, 1700f));
            regionObjects[1] = CreateRegion(world.transform, "The Expanse", new Vector3(0f, 250f, -1600f), new Vector3(2200f, 600f, 2200f));
            regionObjects[2] = CreateRegion(world.transform, "Vertical Megacity", new Vector3(0f, 400f, -3900f), new Vector3(2600f, 900f, 2600f));
            _regions = world.AddComponent<ApexWorldRegionTracker>();
            _regions.Configure(regionObjects);
        }

        private void BuildPlayer()
        {
            var player = new GameObject("Renegade Player");
            player.transform.position = new Vector3(0f, 2.2f, 525f);
            var controller = player.AddComponent<CharacterController>();
            controller.height = 1.85f;
            controller.radius = 0.38f;
            controller.center = new Vector3(0f, 0.92f, 0f);

            _playerHealth = player.AddComponent<HealthComponent>();
            _playerHealth.Configure(100f, 55f);

            var view = new GameObject("View Pivot").transform;
            view.SetParent(player.transform, false);
            view.localPosition = new Vector3(0f, 1.65f, 0f);

            _player = player.AddComponent<ApexFirstPersonMotor>();
            _player.Input = _input;
            _player.SetView(view);
        }

        private void BuildBike()
        {
            var bike = new GameObject("Renegade Bike");
            bike.transform.position = new Vector3(3f, 0.8f, 520f);
            bike.AddComponent<BoxCollider>().size = new Vector3(1.2f, 1.05f, 2.7f);
            var body = bike.AddComponent<Rigidbody>();
            body.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
            _bike = bike.AddComponent<ApexBikeMotor>();

            var visualRoot = new GameObject("Bike Visual Root").transform;
            visualRoot.SetParent(bike.transform, false);
            _bike.SetVisualRoot(visualRoot);

            var dark = ApexPortMaterialFactory.Create("Bike Graphite", new Color(0.025f, 0.03f, 0.04f), 0.85f);
            var spectral = ApexPortMaterialFactory.Create("Bike Spectral", new Color(0.25f, 0.18f, 0.85f), 0.2f, new Color(0.22f, 0.08f, 0.85f));
            var pale = ApexPortMaterialFactory.Create("Bike Pale", new Color(0.28f, 0.34f, 0.40f), 0.62f);
            CreateBlock(visualRoot, "Bike Body", Vector3.zero, new Vector3(1.0f, 0.5f, 2.35f), dark, false);
            CreateBlock(visualRoot, "Spectral Spine", new Vector3(0f, 0.35f, -0.1f), new Vector3(0.22f, 0.14f, 2.6f), spectral, false);
            CreateBlock(visualRoot, "Front Fork", new Vector3(0f, 0.05f, 1.03f), new Vector3(0.16f, 0.65f, 0.13f), pale, false);
            CreateWheel(visualRoot, new Vector3(0f, -0.28f, -1.05f), dark);
            CreateWheel(visualRoot, new Vector3(0f, -0.28f, 1.02f), dark);
        }

        private void BuildCamera()
        {
            var cameraObject = new GameObject("Apex Camera");
            cameraObject.tag = "MainCamera";
            _mainCamera = cameraObject.AddComponent<Camera>();
            _mainCamera.fieldOfView = _settings.Data.fov;
            _mainCamera.nearClipPlane = 0.05f;
            _mainCamera.farClipPlane = 7000f;
            cameraObject.AddComponent<AudioListener>();
            _cameraRig = cameraObject.AddComponent<ApexPortCameraV2>();
            _cameraRig.Configure(_player, _bike, _input, _settings);
        }

        private void BuildCombat()
        {
            _arsenal = gameObject.AddComponent<RenegadeArsenalController>();
            _arsenal.Configure(_mainCamera, _input, _player.gameObject, _bike, _audio);
            _cameraRig.SetArsenal(_arsenal);

            _lifeCycle = _player.gameObject.AddComponent<RenegadeLifeCycle>();
            _lifeCycle.Configure(_playerHealth, _player, _save, _bike);

            _escalation = gameObject.AddComponent<RenegadeEscalationDirector>();
            _escalation.Configure(_playerHealth, _arsenal);

            var audioBridge = gameObject.AddComponent<RenegadeAudioBridge>();
            audioBridge.Configure(_audio, _bike, _playerHealth, _arsenal);
        }

        private void BuildInteractions()
        {
            _scanner = _player.gameObject.AddComponent<ApexInteractionScanner>();
            _scanner.Configure(_input, _mainCamera.transform, _player.gameObject, 5.2f, 0.20f);

            var root = new GameObject("Apex Port // Pickups").transform;
            var ammoMat = ApexPortMaterialFactory.Create("Ammo Pickup", new Color(0.18f, 0.12f, 0.42f), 0.25f, new Color(0.35f, 0.16f, 1f));
            var mawMat = ApexPortMaterialFactory.Create("Maw Ammo Pickup", new Color(0.35f, 0.11f, 0.035f), 0.25f, new Color(1f, 0.18f, 0.025f));
            var healthMat = ApexPortMaterialFactory.Create("Vitality Pickup", new Color(0.28f, 0.04f, 0.08f), 0.1f, new Color(0.9f, 0.06f, 0.12f));
            var shieldMat = ApexPortMaterialFactory.Create("Shield Pickup", new Color(0.05f, 0.22f, 0.36f), 0.1f, new Color(0.08f, 0.42f, 1f));

            CreatePickup(root, "Corona Cell", PrimitiveType.Cube, new Vector3(-7f, 1.1f, 470f), new Vector3(0.65f, 0.65f, 0.65f), ammoMat, RenegadePickupKind.Ammo, 54, "corona-blaster");
            CreatePickup(root, "Maw Shell Cache", PrimitiveType.Cube, new Vector3(8f, 1.1f, 442f), new Vector3(0.9f, 0.5f, 0.65f), mawMat, RenegadePickupKind.Ammo, 18, "maw");
            CreatePickup(root, "Vitality Cache", PrimitiveType.Sphere, new Vector3(-10f, 1.1f, 365f), new Vector3(0.72f, 0.72f, 0.72f), healthMat, RenegadePickupKind.Health, 45);
            CreatePickup(root, "Shield Cache", PrimitiveType.Sphere, new Vector3(11f, 1.1f, 315f), new Vector3(0.72f, 0.72f, 0.72f), shieldMat, RenegadePickupKind.Shield, 40);
        }

        private void CreatePickup(Transform parent, string name, PrimitiveType primitive, Vector3 position, Vector3 scale, Material material, RenegadePickupKind kind, int amount, string weaponId = null)
        {
            var go = GameObject.CreatePrimitive(primitive);
            go.name = name;
            go.transform.SetParent(parent);
            go.transform.position = position;
            go.transform.localScale = scale;
            if (go.TryGetComponent<Renderer>(out var renderer)) renderer.sharedMaterial = material;
            var pickup = go.AddComponent<RenegadePickup>();
            pickup.Configure(kind, amount, _arsenal, _playerHealth, _audio, weaponId);
        }

        private void BuildCheckpoints()
        {
            CreateCheckpoint("scar-entry", "The Scar", new Vector3(0f, 2.2f, 525f), new Vector3(36f, 4f, 10f));
            CreateCheckpoint("expanse-threshold", "The Expanse", new Vector3(0f, 2.2f, -720f), new Vector3(50f, 5f, 12f));
            CreateCheckpoint("vertical-threshold", "Vertical Megacity", new Vector3(0f, 2.2f, -2860f), new Vector3(54f, 6f, 14f));
        }

        private void CreateCheckpoint(string id, string region, Vector3 position, Vector3 size)
        {
            var go = new GameObject($"Checkpoint // {id}");
            go.transform.position = position;
            var trigger = go.AddComponent<BoxCollider>();
            trigger.isTrigger = true;
            trigger.size = size;
            var checkpoint = go.AddComponent<ApexCheckpoint>();
            checkpoint.Configure(id, region);
        }

        private void BuildEncounter()
        {
            var root = new GameObject("Apex Port // Scar Encounter");
            root.transform.position = new Vector3(0f, 0f, 405f);
            _encounterSpawner = root.AddComponent<RenegadeEncounterSpawner>();
            _encounterSpawner.Configure(_player.transform, _arsenal);

            _encounterDefinition = ScriptableObject.CreateInstance<EncounterDefinition>();
            _encounterDefinition.encounterId = "scar-first-contact";
            _encounterDefinition.autoStart = true;
            _encounterDefinition.waves.Add(new EncounterWave
            {
                id = "hollow-response",
                targetCount = 6,
                reinforcementDelay = 0.38f,
                maxSimultaneous = 4,
                archetypeTag = "hollow"
            });
            _encounterDefinition.waves.Add(new EncounterWave
            {
                id = "enforcer-response",
                targetCount = 3,
                reinforcementDelay = 0.85f,
                maxSimultaneous = 2,
                archetypeTag = "enforcer"
            });

            _encounter = root.AddComponent<ApexEncounterController>();
            _encounter.Configure(_encounterDefinition, _encounterSpawner);
        }

        private void BuildHud()
        {
            var hud = gameObject.AddComponent<ApexPortHudV2>();
            hud.Configure(_playerHealth, _arsenal, _bike, _regions, _lifeCycle, _mainCamera, _scanner, _escalation, _telemetry, _settings);
        }

        private static ApexRegionVolume CreateRegion(Transform parent, string id, Vector3 center, Vector3 size)
        {
            var go = new GameObject($"Region // {id}");
            go.transform.SetParent(parent);
            go.transform.position = center;
            var region = go.AddComponent<ApexRegionVolume>();
            region.Configure(id, size);
            return region;
        }

        private static GameObject CreateBlock(Transform parent, string name, Vector3 localPosition, Vector3 scale, Material material, bool collider)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent);
            go.transform.localPosition = localPosition;
            go.transform.localScale = scale;
            if (go.TryGetComponent<Renderer>(out var renderer)) renderer.sharedMaterial = material;
            if (!collider && go.TryGetComponent<Collider>(out var col)) Destroy(col);
            return go;
        }

        private static void CreateWheel(Transform parent, Vector3 localPosition, Material material)
        {
            var wheel = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            wheel.name = "Bike Wheel";
            wheel.transform.SetParent(parent);
            wheel.transform.localPosition = localPosition;
            wheel.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            wheel.transform.localScale = new Vector3(0.55f, 0.14f, 0.55f);
            if (wheel.TryGetComponent<Renderer>(out var renderer)) renderer.sharedMaterial = material;
            if (wheel.TryGetComponent<Collider>(out var col)) Destroy(col);
        }

        private void OnDestroy()
        {
            if (_encounterDefinition != null) Destroy(_encounterDefinition);
        }
    }
}
