using System.Collections;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(520)]
    public sealed class RenegadeBikeCameraCollision : MonoBehaviour
    {
        private readonly RaycastHit[] _hits = new RaycastHit[24];
        private ApexBikeMotor _bike;
        private ApexFirstPersonMotor _player;
        private Camera _camera;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureResolver()
        {
            if (Object.FindFirstObjectByType<RenegadeBikeCameraCollision>() != null) return;
            new GameObject("Apex Bike Camera Collision").AddComponent<RenegadeBikeCameraCollision>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                _player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                _camera = Object.FindFirstObjectByType<Camera>();
                if (_bike != null && _player != null && _camera != null) yield break;
                yield return null;
            }
        }

        private void LateUpdate()
        {
            if (Time.timeScale <= 0f || _bike == null || !_bike.IsMounted || _camera == null) return;
            var pivot = _bike.transform.position + Vector3.up * (1.35f + _bike.WheelieAmount * 0.5f);
            var desired = _camera.transform.position;
            var delta = desired - pivot;
            var distance = delta.magnitude;
            if (distance < 0.2f) return;
            var direction = delta / distance;

            var count = Physics.SphereCastNonAlloc(pivot, 0.28f, direction, _hits, distance, ~0, QueryTriggerInteraction.Ignore);
            var nearest = float.PositiveInfinity;
            Vector3 normal = Vector3.zero;
            var found = false;
            for (var i = 0; i < count; i++)
            {
                var hit = _hits[i];
                if (hit.collider == null) continue;
                var t = hit.collider.transform;
                if (t == _bike.transform || t.IsChildOf(_bike.transform)) continue;
                if (_player != null && (t == _player.transform || t.IsChildOf(_player.transform))) continue;
                if (hit.distance >= nearest) continue;
                nearest = hit.distance;
                normal = hit.normal;
                found = true;
            }

            if (!found) return;
            var safeDistance = Mathf.Max(0.45f, nearest - 0.22f);
            _camera.transform.position = pivot + direction * safeDistance + normal * 0.08f;
        }
    }
}
