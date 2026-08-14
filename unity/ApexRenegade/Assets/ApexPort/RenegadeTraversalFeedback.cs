using System.Collections;
using Apex.Audio;
using Apex.Core;
using Apex.Input;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-570)]
    public sealed class RenegadeTraversalFeedback : MonoBehaviour
    {
        private ApexFirstPersonMotor _motor;
        private ApexAudioService _audio;
        private ApexHapticsService _haptics;
        private ApexPortCameraV2 _camera;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureBridge()
        {
            if (Object.FindFirstObjectByType<RenegadeTraversalFeedback>() != null) return;
            new GameObject("Apex Traversal Feedback").AddComponent<RenegadeTraversalFeedback>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _motor = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                _camera = Object.FindFirstObjectByType<ApexPortCameraV2>();
                if (ApexRuntime.IsInitialized &&
                    ApexRuntime.Services.TryGet<ApexAudioService>(out _audio) &&
                    ApexRuntime.Services.TryGet<ApexHapticsService>(out _haptics) &&
                    _motor != null && _camera != null)
                {
                    _motor.Footstep += OnFootstep;
                    _motor.Jumped += OnJumped;
                    _motor.Landed += OnLanded;
                    _motor.SlideStarted += OnSlide;
                    _motor.DashStarted += OnDash;
                    yield break;
                }
                yield return null;
            }
        }

        private void OnFootstep(float speed01)
        {
            var pitch = Random.Range(0.93f, 1.08f) * Mathf.Lerp(0.94f, 1.08f, speed01);
            _audio?.Play("player.step", Mathf.Lerp(0.20f, 0.38f, speed01), ApexAudioBus.Sfx, pitch);
        }

        private void OnJumped()
        {
            _audio?.Play("player.jump", 0.34f);
            _haptics?.Pulse(0.08f, 0.14f, 0.045f);
            _camera?.Impulse.Kick(new Vector3(0f, -0.008f, 0f), new Vector3(0.55f, 0f, 0f));
        }

        private void OnLanded(float impactSpeed)
        {
            var weight = Mathf.InverseLerp(3f, 18f, impactSpeed);
            _audio?.Play("player.land", Mathf.Lerp(0.28f, 0.80f, weight), ApexAudioBus.Sfx, Mathf.Lerp(1.08f, 0.78f, weight));
            _haptics?.Pulse(Mathf.Lerp(0.08f, 0.46f, weight), Mathf.Lerp(0.08f, 0.24f, weight), Mathf.Lerp(0.045f, 0.12f, weight));
            _camera?.Impulse.Kick(new Vector3(0f, -Mathf.Lerp(0.015f, 0.075f, weight), 0f), new Vector3(Mathf.Lerp(0.8f, 3.4f, weight), 0f, 0f));
            if (weight > 0.55f) _camera?.Impulse.Shake(Mathf.Lerp(0.06f, 0.24f, weight), 23f);
        }

        private void OnSlide()
        {
            _audio?.Play("player.slide", 0.52f, ApexAudioBus.Sfx, Random.Range(0.92f, 1.04f));
            _haptics?.Pulse(0.18f, 0.10f, 0.11f);
            _camera?.Impulse.Kick(new Vector3(0f, -0.035f, -0.025f), new Vector3(2.1f, 0f, 0f));
        }

        private void OnDash()
        {
            _audio?.Play("player.dash", 0.48f);
            _haptics?.Pulse(0.12f, 0.34f, 0.075f);
            _camera?.Impulse.Kick(new Vector3(0f, 0f, -0.065f), new Vector3(-0.9f, 0f, 0f));
        }

        private void OnDestroy()
        {
            if (_motor == null) return;
            _motor.Footstep -= OnFootstep;
            _motor.Jumped -= OnJumped;
            _motor.Landed -= OnLanded;
            _motor.SlideStarted -= OnSlide;
            _motor.DashStarted -= OnDash;
        }
    }
}
