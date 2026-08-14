using System;
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
        [SerializeField] private float crouchSpeed = 3.4f;
        [SerializeField] private float groundAcceleration = 30f;
        [SerializeField] private float groundDeceleration = 36f;
        [SerializeField] private float airAcceleration = 8.5f;
        [SerializeField] private float jumpSpeed = 7.2f;
        [SerializeField] private float gravity = 24f;
        [SerializeField] private float dashImpulse = 8.5f;
        [SerializeField] private float slideEntrySpeed = 8.8f;
        [SerializeField] private float slideDuration = 0.72f;

        private CharacterController _controller;
        private float _standingHeight;
        private Vector3 _standingCenter;
        private float _standingViewY;
        private float _verticalVelocity;
        private float _yaw;
        private float _pitch;
        private Vector3 _planarVelocity;
        private Vector3 _dashVelocity;
        private Vector3 _slideVelocity;
        private float _dashCooldown;
        private float _slideTimer;
        private float _slideCooldown;
        private bool _wasGrounded;
        private float _peakFallSpeed;
        private float _stepDistance;
        private Vector3 _lastStepPosition;

        public bool MovementEnabled { get; private set; } = true;
        public Transform View => view;
        public Vector3 Velocity { get; private set; }
        public bool IsCrouching { get; private set; }
        public bool IsSliding => _slideTimer > 0f;
        public bool IsGrounded => _controller != null && _controller.enabled && _controller.isGrounded;
        public bool IsSprinting { get; private set; }
        public float HorizontalSpeed => Vector3.ProjectOnPlane(Velocity, Vector3.up).magnitude;

        public event Action Jumped;
        public event Action<float> Landed;
        public event Action SlideStarted;
        public event Action DashStarted;
        public event Action<float> Footstep;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            _standingHeight = _controller.height;
            _standingCenter = _controller.center;
            if (view == null)
            {
                var camera = GetComponentInChildren<Camera>();
                if (camera != null) view = camera.transform;
            }
            _standingViewY = view != null ? view.localPosition.y : 1.65f;
            _yaw = transform.eulerAngles.y;
            _lastStepPosition = transform.position;
        }

        public void SetView(Transform target)
        {
            view = target;
            if (view != null) _standingViewY = view.localPosition.y;
        }

        public void SetMountedState(bool mounted)
        {
            MovementEnabled = !mounted;
            if (_controller != null) _controller.enabled = !mounted;
            _verticalVelocity = 0f;
            _planarVelocity = Vector3.zero;
            _dashVelocity = Vector3.zero;
            _slideVelocity = Vector3.zero;
            _slideTimer = 0f;
            IsSprinting = false;
        }

        private void Update()
        {
            if (Time.timeScale <= 0f || Input == null || !MovementEnabled || _controller == null || !_controller.enabled) return;
            var dt = Time.deltaTime;
            _dashCooldown = Mathf.Max(0f, _dashCooldown - dt);
            _slideCooldown = Mathf.Max(0f, _slideCooldown - dt);

            var look = Input.ReadLook(dt, Input.Held(Input.Aim));
            _yaw += look.x;
            _pitch = Mathf.Clamp(_pitch - look.y, -88f, 88f);
            transform.rotation = Quaternion.Euler(0f, _yaw, 0f);
            if (view != null) view.localRotation = Quaternion.Euler(_pitch, 0f, 0f);

            var grounded = _controller.isGrounded;
            if (grounded && !_wasGrounded)
            {
                var impact = Mathf.Abs(Mathf.Min(0f, _peakFallSpeed));
                if (impact > 2.5f) Landed?.Invoke(impact);
                _peakFallSpeed = 0f;
            }

            var move = Input.ReadMove();
            var wish = transform.forward * move.y + transform.right * move.x;
            if (wish.sqrMagnitude > 1f) wish.Normalize();

            var crouchHeld = Input.Held(Input.Crouch);
            IsSprinting = grounded && !crouchHeld && !IsSliding && Input.Held(Input.Sprint) && move.y > 0.12f;

            if (grounded && Input.Pressed(Input.Crouch) && !IsSliding && _slideCooldown <= 0f && (IsSprinting || _planarVelocity.magnitude > 6.4f))
                BeginSlide(wish);

            if (IsSliding)
            {
                _slideTimer = Mathf.Max(0f, _slideTimer - dt);
                var steering = wish.sqrMagnitude > 0.01f ? wish.normalized : Vector3.zero;
                _slideVelocity = Vector3.Lerp(_slideVelocity, steering * Mathf.Max(5.5f, _slideVelocity.magnitude), 1f - Mathf.Exp(-1.6f * dt));
                _slideVelocity = Vector3.MoveTowards(_slideVelocity, Vector3.zero, 5.8f * dt);
                if (_slideTimer <= 0f || _slideVelocity.magnitude < 4.2f) EndSlide();
            }

            IsCrouching = crouchHeld || IsSliding;
            UpdateStance(dt);

            var targetSpeed = IsCrouching ? crouchSpeed : (IsSprinting ? sprintSpeed : moveSpeed);
            var desired = wish * targetSpeed;
            var acceleration = grounded
                ? (desired.sqrMagnitude > 0.01f ? groundAcceleration : groundDeceleration)
                : airAcceleration;
            if (!IsSliding)
                _planarVelocity = Vector3.MoveTowards(_planarVelocity, desired, acceleration * dt);
            else
                _planarVelocity = Vector3.Lerp(_planarVelocity, Vector3.zero, 1f - Mathf.Exp(-8f * dt));

            if (grounded)
            {
                if (_verticalVelocity < 0f) _verticalVelocity = -2f;
                if (Input.Pressed(Input.Jump) && !IsCrouching)
                {
                    _verticalVelocity = jumpSpeed;
                    Jumped?.Invoke();
                }
            }
            else
            {
                _verticalVelocity -= gravity * dt;
                _peakFallSpeed = Mathf.Min(_peakFallSpeed, _verticalVelocity);
            }

            if (Input.Pressed(Input.Dash) && _dashCooldown <= 0f)
            {
                var dashDirection = wish.sqrMagnitude > 0.05f ? wish.normalized : transform.forward;
                _dashVelocity = dashDirection * dashImpulse;
                _dashCooldown = 0.72f;
                DashStarted?.Invoke();
            }
            _dashVelocity = Vector3.Lerp(_dashVelocity, Vector3.zero, 1f - Mathf.Exp(-9f * dt));

            var horizontal = _planarVelocity + _dashVelocity + (IsSliding ? _slideVelocity : Vector3.zero);
            Velocity = horizontal + Vector3.up * _verticalVelocity;
            _controller.Move(Velocity * dt);
            UpdateFootsteps(grounded, dt);
            _wasGrounded = grounded;
        }

        private void BeginSlide(Vector3 wish)
        {
            var current = _planarVelocity;
            var direction = current.sqrMagnitude > 0.5f ? current.normalized : (wish.sqrMagnitude > 0.05f ? wish.normalized : transform.forward);
            _slideVelocity = direction * Mathf.Max(slideEntrySpeed, current.magnitude + 1.2f);
            _slideTimer = slideDuration;
            _slideCooldown = 0.95f;
            SlideStarted?.Invoke();
        }

        private void EndSlide()
        {
            if (_slideVelocity.sqrMagnitude > 0.01f)
                _planarVelocity += Vector3.ClampMagnitude(_slideVelocity, sprintSpeed) * 0.45f;
            _slideVelocity = Vector3.zero;
            _slideTimer = 0f;
        }

        private void UpdateStance(float dt)
        {
            var targetHeight = IsCrouching ? Mathf.Max(1.05f, _standingHeight * 0.64f) : _standingHeight;
            var nextHeight = Mathf.Lerp(_controller.height, targetHeight, 1f - Mathf.Exp(-15f * dt));
            _controller.height = nextHeight;
            _controller.center = new Vector3(_standingCenter.x, nextHeight * 0.5f, _standingCenter.z);
            if (view != null)
            {
                var targetY = IsCrouching ? _standingViewY * 0.68f : _standingViewY;
                var p = view.localPosition;
                p.y = Mathf.Lerp(p.y, targetY, 1f - Mathf.Exp(-13f * dt));
                view.localPosition = p;
            }
        }

        private void UpdateFootsteps(bool grounded, float dt)
        {
            if (!grounded || IsSliding || HorizontalSpeed < 1.2f)
            {
                _lastStepPosition = transform.position;
                _stepDistance = 0f;
                return;
            }

            var planarDelta = Vector3.ProjectOnPlane(transform.position - _lastStepPosition, Vector3.up).magnitude;
            _lastStepPosition = transform.position;
            _stepDistance += planarDelta;
            var stride = Mathf.Lerp(1.65f, 1.15f, Mathf.InverseLerp(moveSpeed, sprintSpeed, HorizontalSpeed));
            if (_stepDistance < stride) return;
            _stepDistance = 0f;
            Footstep?.Invoke(Mathf.Clamp01(HorizontalSpeed / sprintSpeed));
        }

        public void Teleport(Vector3 position, Quaternion rotation)
        {
            var wasEnabled = _controller.enabled;
            _controller.enabled = false;
            transform.SetPositionAndRotation(position, rotation);
            _yaw = rotation.eulerAngles.y;
            _verticalVelocity = 0f;
            _planarVelocity = Vector3.zero;
            _dashVelocity = Vector3.zero;
            _slideVelocity = Vector3.zero;
            _slideTimer = 0f;
            _peakFallSpeed = 0f;
            _lastStepPosition = position;
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
        [SerializeField] private float brakeAcceleration = 26f;
        [SerializeField] private float steerDegreesPerSecond = 90f;
        [SerializeField] private float driftGrip = 1.35f;
        [SerializeField] private float roadGrip = 8f;
        [SerializeField] private float mountRadius = 5.8f;
        [SerializeField] private float recallSpeed = 65f;
        [SerializeField] private Transform visualRoot;

        private Rigidbody _body;
        private ApexFirstPersonMotor _rider;
        private ApexInputService _input;
        private bool _recalling;
        private bool _boosting;
        private float _boostEnergy = 100f;
        private float _wheelieAmount;
        private float _driftAmount;
        private float _visualLean;
        private Vector3 _lastSafePosition;
        private float _safeTimer;

        public bool IsMounted => _rider != null;
        public float BoostEnergy => _boostEnergy;
        public float Speed => _body != null ? Vector3.Dot(_body.velocity, transform.forward) : 0f;
        public float PlanarSpeed => _body != null ? Vector3.ProjectOnPlane(_body.velocity, Vector3.up).magnitude : 0f;
        public bool IsRecalling => _recalling;
        public bool IsBoosting => _boosting;
        public float WheelieAmount => _wheelieAmount;
        public float DriftAmount => _driftAmount;
        public ApexFirstPersonMotor Rider => _rider;
        public float MountRadius => mountRadius;

        public event Action Mounted;
        public event Action Dismounted;
        public event Action RecallStarted;
        public event Action RecallArrived;
        public event Action BoostStarted;
        public event Action BoostStopped;

        private void Awake()
        {
            _body = GetComponent<Rigidbody>();
            _body.mass = 420f;
            _body.centerOfMass = new Vector3(0f, -0.45f, 0.15f);
            _body.interpolation = RigidbodyInterpolation.Interpolate;
            _body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            _lastSafePosition = transform.position;
        }

        public void SetVisualRoot(Transform root) => visualRoot = root;

        private void FixedUpdate()
        {
            if (Time.timeScale <= 0f || !IsMounted || _input == null) return;
            var dt = Time.fixedDeltaTime;
            var move = _input.ReadMove();
            var throttle = _input.Held(_input.Fire) ? 1f : 0f;
            var brake = _input.Held(_input.Aim) ? 1f : 0f;
            var steer = move.x;
            var drifting = _input.Held(_input.Drift) && Mathf.Abs(Speed) > 7f;
            var boosting = _input.Held(_input.Boost) && _boostEnergy > 0.1f && throttle > 0f;

            if (boosting != _boosting)
            {
                _boosting = boosting;
                if (_boosting) BoostStarted?.Invoke();
                else BoostStopped?.Invoke();
            }

            var forwardSpeed = Vector3.Dot(_body.velocity, transform.forward);
            if (throttle > 0f) _body.AddForce(transform.forward * acceleration, ForceMode.Acceleration);
            if (brake > 0f)
            {
                var brakeDirection = Mathf.Abs(forwardSpeed) > 2f ? -Mathf.Sign(forwardSpeed) * transform.forward : -transform.forward;
                _body.AddForce(brakeDirection * brakeAcceleration, ForceMode.Acceleration);
            }

            var speed01 = Mathf.Clamp01(Mathf.Abs(forwardSpeed) / Mathf.Max(1f, maxSpeed));
            var steerRate = Mathf.Lerp(steerDegreesPerSecond, steerDegreesPerSecond * 0.44f, speed01);
            if (drifting) steerRate *= 1.16f;
            var yaw = steer * steerRate * dt * (forwardSpeed >= -0.5f ? 1f : -1f);
            _body.MoveRotation(_body.rotation * Quaternion.Euler(0f, yaw, 0f));

            var local = transform.InverseTransformDirection(_body.velocity);
            var grip = drifting ? driftGrip : roadGrip;
            local.x = Mathf.Lerp(local.x, 0f, 1f - Mathf.Exp(-grip * dt));
            _body.velocity = transform.TransformDirection(local);

            var driftTarget = drifting ? Mathf.Clamp01(Mathf.Abs(local.x) / 12f + Mathf.Abs(steer) * 0.45f) : 0f;
            _driftAmount = Mathf.Lerp(_driftAmount, driftTarget, 1f - Mathf.Exp(-8f * dt));

            var wheelieInput = throttle > 0.25f && move.y < -0.22f && Mathf.Abs(forwardSpeed) > 4f
                ? Mathf.Clamp01((-move.y - 0.18f) / 0.72f) * Mathf.Clamp01(Mathf.Abs(forwardSpeed) / 16f)
                : 0f;
            _wheelieAmount = Mathf.Lerp(_wheelieAmount, wheelieInput, 1f - Mathf.Exp(-(wheelieInput > _wheelieAmount ? 7f : 5f) * dt));

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

            _safeTimer -= dt;
            if (_safeTimer <= 0f && Mathf.Abs(_body.velocity.y) < 4f)
            {
                _safeTimer = 0.45f;
                _lastSafePosition = transform.position;
            }
            if (transform.position.y < -25f)
            {
                _body.velocity = Vector3.zero;
                _body.angularVelocity = Vector3.zero;
                transform.position = _lastSafePosition + Vector3.up * 1.2f;
            }
        }

        private void Update()
        {
            if (Time.timeScale <= 0f) return;

            if (_recalling && !IsMounted)
            {
                var player = UnityEngine.Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                if (player != null)
                {
                    var target = player.transform.position + player.transform.right * 2.2f;
                    var to = target - transform.position;
                    if (to.magnitude < 3.5f)
                    {
                        _recalling = false;
                        _body.isKinematic = false;
                        _body.velocity = Vector3.zero;
                        RecallArrived?.Invoke();
                    }
                    else
                    {
                        _body.isKinematic = true;
                        transform.position += to.normalized * Mathf.Min(recallSpeed * Time.deltaTime, to.magnitude);
                        var planar = Vector3.ProjectOnPlane(to, Vector3.up);
                        if (planar.sqrMagnitude > 0.01f)
                            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(planar), 1f - Mathf.Exp(-7f * Time.deltaTime));
                    }
                }
            }

            UpdateVisualPose(Time.deltaTime);
        }

        private void UpdateVisualPose(float dt)
        {
            if (visualRoot == null) return;
            var steer = _input != null && IsMounted ? _input.ReadMove().x : 0f;
            var targetLean = -steer * Mathf.Lerp(7f, 19f, _driftAmount);
            _visualLean = Mathf.Lerp(_visualLean, targetLean, 1f - Mathf.Exp(-7f * dt));
            var wheeliePitch = -38f * _wheelieAmount;
            var boostPitch = _boosting ? 2.5f : 0f;
            visualRoot.localRotation = Quaternion.Slerp(
                visualRoot.localRotation,
                Quaternion.Euler(wheeliePitch + boostPitch, 0f, _visualLean),
                1f - Mathf.Exp(-9f * dt));
            visualRoot.localPosition = Vector3.Lerp(
                visualRoot.localPosition,
                new Vector3(0f, 0.08f * _wheelieAmount, -0.12f * _wheelieAmount),
                1f - Mathf.Exp(-9f * dt));
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
            Mounted?.Invoke();
        }

        public void Dismount()
        {
            if (_rider == null) return;
            var rider = _rider;
            _rider = null;
            _input = null;
            _wheelieAmount = 0f;
            rider.Teleport(transform.position + transform.right * 1.8f + Vector3.up * 0.5f, Quaternion.Euler(0f, transform.eulerAngles.y, 0f));
            rider.SetMountedState(false);
            Dismounted?.Invoke();
        }

        public void Recall()
        {
            if (IsMounted || _recalling) return;
            _recalling = true;
            RecallStarted?.Invoke();
        }
    }
}
