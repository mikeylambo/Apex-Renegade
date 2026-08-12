using Apex.Core;
using Apex.Debugging;
using Apex.Input;
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
        private ApexInputService _input;
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private ApexPortCamera _cameraRig;
        private ApexWorldRegionTracker _regions;

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

            var inputObject = new GameObject("Apex Input Service");
            inputObject.transform.SetParent(transform);
            _input = inputObject.AddComponent<ApexInputService>();
            _input.Initialize(ApexRuntime.Services);

            gameObject.AddComponent<ApexTelemetry>();
            BuildWorld();
            BuildPlayer();
            BuildBike();
            BuildCamera();

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

            if (_input.Pressed(_input.Pause))
            {
                var locked = Cursor.lockState == CursorLockMode.Locked;
                Cursor.lockState = locked ? CursorLockMode.None : CursorLockMode.Locked;
                Cursor.visible = locked;
            }

            if (_regions != null)
                _regions.SetObserver(_bike.IsMounted ? _bike.transform : _player.transform);
        }

        private void BuildWorld()
        {
            if (GameObject.Find("Apex Port World") != null) return;
            var world = new GameObject("Apex Port World");

            var sky = Camera.main;
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

            var groundMat = MakeMaterial("Ground", new Color(0.12f, 0.14f, 0.15f), 0.15f);
            var roadMat = MakeMaterial("Road", new Color(0.055f, 0.065f, 0.07f), 0.05f);
            var cityMat = MakeMaterial("City", new Color(0.07f, 0.09f, 0.12f), 0.3f);

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

            var dark = MakeMaterial("Bike Graphite", new Color(0.025f, 0.03f, 0.04f), 0.85f);
            var spectral = MakeMaterial("Bike Spectral", new Color(0.25f, 0.18f, 0.85f), 0.2f);
            CreateBlock(bike.transform, "Bike Body", new Vector3(0f, 0f, 0f), new Vector3(1.0f, 0.5f, 2.35f), dark, false);
            CreateBlock(bike.transform, "Spectral Spine", new Vector3(0f, 0.35f, -0.1f), new Vector3(0.22f, 0.14f, 2.6f), spectral, false);
            CreateWheel(bike.transform, new Vector3(0f, -0.28f, -1.05f), dark);
            CreateWheel(bike.transform, new Vector3(0f, -0.28f, 1.02f), dark);
        }

        private void BuildCamera()
        {
            var cameraObject = new GameObject("Apex Camera");
            var camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = _settings.Data.fov;
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 7000f;
            cameraObject.AddComponent<AudioListener>();
            _cameraRig = cameraObject.AddComponent<ApexPortCamera>();
            _cameraRig.Configure(_player, _bike, _input, _settings);
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

        private static Material MakeMaterial(string name, Color color, float metallic)
        {
            var shader = Shader.Find("Standard") ?? Shader.Find("Unlit/Color");
            var material = new Material(shader) { name = name, color = color };
            if (material.HasProperty("_Metallic")) material.SetFloat("_Metallic", metallic);
            if (material.HasProperty("_Glossiness")) material.SetFloat("_Glossiness", 0.35f);
            return material;
        }
    }

    public sealed class ApexPortCamera : MonoBehaviour
    {
        private ApexFirstPersonMotor _player;
        private ApexBikeMotor _bike;
        private ApexInputService _input;
        private ApexSettingsService _settings;
        private float _orbitYaw;
        private float _orbitPitch = 10f;
        private float _lastLookTime = -10f;
        private Vector3 _velocity;

        public void Configure(ApexFirstPersonMotor player, ApexBikeMotor bike, ApexInputService input, ApexSettingsService settings)
        {
            _player = player;
            _bike = bike;
            _input = input;
            _settings = settings;
        }

        private void LateUpdate()
        {
            if (_player == null || _bike == null || _input == null) return;
            var camera = GetComponent<Camera>();
            camera.fieldOfView = Mathf.Lerp(camera.fieldOfView, _settings.Data.fov + (_bike.IsMounted ? Mathf.Clamp01(Mathf.Abs(_bike.Speed) / 70f) * 12f : 0f), 1f - Mathf.Exp(-6f * Time.deltaTime));

            if (!_bike.IsMounted)
            {
                var view = _player.View;
                if (view == null) return;
                transform.SetPositionAndRotation(view.position, view.rotation);
                _orbitYaw = 0f;
                _orbitPitch = 10f;
                return;
            }

            var look = _input.ReadLook(Time.deltaTime, false);
            if (look.sqrMagnitude > 0.0001f)
            {
                _orbitYaw += look.x;
                _orbitPitch = Mathf.Clamp(_orbitPitch - look.y, -12f, 46f);
                _lastLookTime = Time.unscaledTime;
            }
            else if (Time.unscaledTime - _lastLookTime > 1.5f)
            {
                _orbitYaw = Mathf.LerpAngle(_orbitYaw, 0f, 1f - Mathf.Exp(-1.7f * Time.deltaTime));
                _orbitPitch = Mathf.Lerp(_orbitPitch, 10f, 1f - Mathf.Exp(-1.7f * Time.deltaTime));
            }

            var speed01 = Mathf.Clamp01(Mathf.Abs(_bike.Speed) / 78f);
            var pivot = _bike.transform.position + Vector3.up * (1.45f + speed01 * 0.25f);
            var orbit = Quaternion.Euler(_orbitPitch, _bike.transform.eulerAngles.y + _orbitYaw, 0f);
            var desired = pivot + orbit * new Vector3(0f, 0.6f, -(6.5f + speed01 * 4.5f));
            transform.position = Vector3.SmoothDamp(transform.position, desired, ref _velocity, speed01 > 0.4f ? 0.075f : 0.11f, Mathf.Infinity, Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation((pivot + _bike.transform.forward * (4f + speed01 * 7f)) - transform.position, Vector3.up), 1f - Mathf.Exp(-9f * Time.deltaTime));
        }
    }
}
