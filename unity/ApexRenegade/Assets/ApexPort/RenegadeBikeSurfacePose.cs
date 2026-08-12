using System.Collections;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(320)]
    public sealed class RenegadeBikeSurfacePose : MonoBehaviour
    {
        private ApexBikeMotor _bike;
        private Transform _visualRoot;
        private float _groundPitch;
        private float _suspension;

        public float GroundPitch => _groundPitch;
        public float SuspensionTravel => _suspension;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureInstaller()
        {
            if (Object.FindFirstObjectByType<RenegadeBikeSurfacePose>() != null) return;
            new GameObject("Apex Bike Surface Pose").AddComponent<RenegadeBikeSurfacePose>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 120; i++)
            {
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                if (_bike != null)
                {
                    _visualRoot = _bike.transform.Find("Bike Visual Root");
                    if (_visualRoot != null) yield break;
                }
                yield return null;
            }
        }

        private void LateUpdate()
        {
            if (Time.timeScale <= 0f || _bike == null || _visualRoot == null) return;
            var dt = Time.deltaTime;
            var root = _bike.transform;
            var frontOrigin = root.position + root.forward * 1.05f + Vector3.up * 1.0f;
            var rearOrigin = root.position - root.forward * 1.05f + Vector3.up * 1.0f;
            var frontHit = Physics.Raycast(frontOrigin, Vector3.down, out var front, 3.2f, ~0, QueryTriggerInteraction.Ignore);
            var rearHit = Physics.Raycast(rearOrigin, Vector3.down, out var rear, 3.2f, ~0, QueryTriggerInteraction.Ignore);

            var targetPitch = 0f;
            var targetSuspension = 0f;
            if (frontHit && rearHit)
            {
                targetPitch = Mathf.Atan2(front.point.y - rear.point.y, 2.1f) * Mathf.Rad2Deg;
                targetPitch = Mathf.Clamp(targetPitch, -22f, 22f);
                var averageDistance = (front.distance + rear.distance) * 0.5f;
                targetSuspension = Mathf.Clamp((1.04f - averageDistance) * 0.16f, -0.06f, 0.09f);
            }

            _groundPitch = Mathf.Lerp(_groundPitch, targetPitch, 1f - Mathf.Exp(-9f * dt));
            _suspension = Mathf.Lerp(_suspension, targetSuspension, 1f - Mathf.Exp(-12f * dt));

            // ApexBikeMotor has already authored wheelie + drift lean during Update.
            // Add terrain pitch in LateUpdate so these effects compose instead of compete.
            var currentEuler = _visualRoot.localEulerAngles;
            var authoredPitch = Mathf.DeltaAngle(0f, currentEuler.x);
            var authoredYaw = Mathf.DeltaAngle(0f, currentEuler.y);
            var authoredRoll = Mathf.DeltaAngle(0f, currentEuler.z);
            _visualRoot.localRotation = Quaternion.Euler(authoredPitch + _groundPitch, authoredYaw, authoredRoll);
            var p = _visualRoot.localPosition;
            p.y += _suspension;
            _visualRoot.localPosition = p;
        }
    }
}
