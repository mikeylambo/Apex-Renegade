using Apex.Input;
using UnityEngine;

namespace Apex.Traversal
{
    public interface IApexMountable
    {
        bool IsMounted { get; }
        bool CanMount(Transform rider);
        void Mount(ApexFirstPersonMotor rider);
        void Dismount();
    }

    [RequireComponent(typeof(CharacterController))]
    public sealed class ApexFirstPersonMotor : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform view;
        public ApexInputService Input { get; set; }

        [Header("Movement")]
        [SerializeField] private float moveSpeed = 5.25f;
        [SerializeField] private float sprintSpeed = 7.9f;
        [SerializeField] private float jumpSpeed = 7.2f;
        [SerializeField] private float gravity = 24f;

        private CharacterController _controller;
        private float _verticalVelocity;
        private float _yaw;
        private float _pitch;
        public bool MovementEnabled { get; private set; } = true;
        public Transform View => view;
        public Vector3 Velocity { get; private set; }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            if (view == null)
            {
                var camera = GetComponentInChildren<Camera>();
                if (camera != null) view = camera.transform;
            }
            _yaw = transform.eulerAngles.y;
        }

        public void SetView(Transform target) => view = target;

        public void SetMountedState(bool mounted)
        {
            MovementEnabled = !mounted;
            if (_controller != null) _controller.enabled = !mounted;
            _verticalVelocity = 0f;
        }

        private void Update()
        {
            if (Input == null || !MovementEnabled) return;
            var dt = Time.deltaTime;
            var look = Input.ReadLook(dt, Input.Held(Input.Aim));
            _yaw += look.x;
            _pitch = Mathf.Clamp(_pitch - look.y, -88f, 88f);
            transform.rotation = Quaternion.Euler(0f, _yaw, 0f);
            if (view != null) view.localRotation = Quaternion.Euler(_pitch, 0f, 0f);

            var move = Input.ReadMove();
            var wish = transform.forward * move.y + transform.right * move.x;
            if (wish.sqrMagnitude > 1f) wish.Normalize();
            var speed = Input.Held(Input.Sprint) ? sprintSpeed : moveSpeed;

            if (_controller.isGrounded)
            {
                _verticalVelocity = -2f;
                if (Input.Pressed(Input.Jump)) _verticalVelocity = jumpSpeed;
            }
            else _verticalVelocity -= gravity * dt;

            Velocity = wish * speed + Vector3.up * _verticalVelocity;
            _controller.Move(Velocity * dt);
        }

        public void Teleport(Vector3 position, Quaternion rotation)
        {
            var wasEnabled = _controller.enabled;
            _controller.enabled = false;
            transform.SetPositionAndRotation(position, rotation);
            _yaw = rotation.eulerAngles.y;
            _verticalVelocity = 0f;
            _controller.enabled = wasEnabled;
        }
    }

    [RequireComponent(typeof(Rigidbody))]
    public sealed class ApexBikeMotor : MonoBehaviour, IApexMountable
    {
        [Header("Bike")]
        [SerializeField] private float maxSpeed = 50f;
        [SerializeField] private float boostSpeed = 78f;
        [SerializeField] private float acceleration = 32f;
        [SerializeField] private float steerDegreesPerSecond = 90f;
        [SerializeField] private float driftGrip = 1.5f;
        [SerializeField] private float roadGrip = 8f;
        [SerializeField] private float mountRadius = 5.8f;
        [SerializeField] private float recallSpeed = 65f;

        private Rigidbody _body;
        private ApexFirstPersonMotor _rider;
        private ApexInputService _input;
        private bool _recalling;
        private float _boostEnergy = 100f;
        public bool IsMounted => _rider != null;
        public float BoostEnergy => _boostEnergy;
        public float Speed => Vector3.Dot(_body.velocity, transform.forward);
        public bool IsRecalling => _recalling;
        public ApexFirstPersonMotor Rider => _rider;

        private void Awake()
        {
            _body = GetComponent<Rigidbody>();
            _body.mass = 420f;
            _body.centerOfMass = new Vector3(0f, -0.45f, 0.15f);
            _body.interpolation = RigidbodyInterpolation.Interpolate;
            _body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
        }

        private void FixedUpdate()
        {
            if (!IsMounted || _input == null) return;
            var dt = Time.fixedDeltaTime;
            var throttle = _input.Held(_input.Fire) ? 1f : 0f;
            var brake = _input.Held(_input.Aim) ? 1f : 0f;
            var steer = _input.ReadMove().x;
            var drifting = _input.Held(_input.Drift) && Mathf.Abs(Speed) > 8f;
            var boosting = _input.Held(_input.Boost) && _boostEnergy > 0.1f;

            var forwardSpeed = Vector3.Dot(_body.velocity, transform.forward);
            if (throttle > 0f) _body.AddForce(transform.forward * acceleration, ForceMode.Acceleration);
            if (brake > 0f) _body.AddForce(-transform.forward * acceleration * 0.7f, ForceMode.Acceleration);

            var speed01 = Mathf.Clamp01(Mathf.Abs(forwardSpeed) / Mathf.Max(1f, maxSpeed));
            var steerRate = Mathf.Lerp(steerDegreesPerSecond, steerDegreesPerSecond * 0.42f, speed01);
            var yaw = steer * steerRate * dt * (forwardSpeed >= -0.5f ? 1f : -1f);
            _body.MoveRotation(_body.rotation * Quaternion.Euler(0f, yaw, 0f));

            var local = transform.InverseTransformDirection(_body.velocity);
            var grip = drifting ? driftGrip : roadGrip;
            local.x = Mathf.Lerp(local.x, 0f, 1f - Mathf.Exp(-grip * dt));
            _body.velocity = transform.TransformDirection(local);

            if (boosting)
            {
                _body.AddForce(transform.forward * 38f, ForceMode.Acceleration);
                _boostEnergy = Mathf.Max(0f, _boostEnergy - 22f * dt);
            }
            else _boostEnergy = Mathf.Min(100f, _boostEnergy + (drifting ? 24f : 13f) * dt);

            var cap = boosting ? boostSpeed : maxSpeed;
            var planar = Vector3.ProjectOnPlane(_body.velocity, Vector3.up);
            if (planar.magnitude > cap)
            {
                var vertical = Vector3.Project(_body.velocity, Vector3.up);
                _body.velocity = planar.normalized * cap + vertical;
            }
        }

        private void Update()
        {
            if (!_recalling || IsMounted) return;
            var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
            if (player == null) return;
            var target = player.transform.position + player.transform.right * 2.2f;
            var to = target - transform.position;
            if (to.magnitude < 3.5f)
            {
                _recalling = false;
                _body.isKinematic = false;
                _body.velocity = Vector3.zero;
                return;
            }
            _body.isKinematic = true;
            transform.position += to.normalized * Mathf.Min(recallSpeed * Time.deltaTime, to.magnitude);
            var planar = Vector3.ProjectOnPlane(to, Vector3.up);
            if (planar.sqrMagnitude > 0.01f)
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(planar), 1f - Mathf.Exp(-7f * Time.deltaTime));
        }

        public bool CanMount(Transform rider) => rider != null && Vector3.Distance(rider.position, transform.position) <= mountRadius;

        public void Mount(ApexFirstPersonMotor rider)
        {
            if (rider == null || IsMounted || !CanMount(rider.transform)) return;
            _recalling = false;
            _body.isKinematic = false;
            _rider = rider;
            _input = rider.Input;
            rider.SetMountedState(true);
        }

        public void Dismount()
        {
            if (_rider == null) return;
            var rider = _rider;
            _rider = null;
            _input = null;
            rider.Teleport(transform.position + transform.right * 1.8f + Vector3.up * 0.5f, Quaternion.Euler(0f, transform.eulerAngles.y, 0f));
            rider.SetMountedState(false);
        }

        public void Recall()
        {
            if (!IsMounted) _recalling = true;
        }
    }
}
