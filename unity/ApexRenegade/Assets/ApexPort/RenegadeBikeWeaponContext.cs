using System.Collections;
using Apex.Traversal;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeBikeWeaponContext : MonoBehaviour
    {
        private ApexBikeMotor _bike;
        private RenegadeArsenalController _arsenal;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureBridge()
        {
            if (Object.FindFirstObjectByType<RenegadeBikeWeaponContext>() != null) return;
            new GameObject("Apex Bike Weapon Context").AddComponent<RenegadeBikeWeaponContext>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 120; i++)
            {
                _bike = Object.FindFirstObjectByType<ApexBikeMotor>();
                _arsenal = Object.FindFirstObjectByType<RenegadeArsenalController>();
                if (_bike != null && _arsenal != null)
                {
                    _bike.Mounted += OnMounted;
                    _bike.Dismounted += OnDismounted;
                    yield break;
                }
                yield return null;
            }
        }

        private void OnMounted()
        {
            _arsenal?.BikeWeapon?.Equip();
        }

        private void OnDismounted()
        {
            if (_arsenal == null) return;
            if (_arsenal.ActiveWeapon != null && _arsenal.ActiveWeapon != _arsenal.BikeWeapon)
            {
                _arsenal.BikeWeapon?.Holster();
                _arsenal.ActiveWeapon.Equip();
            }
        }

        private void OnDestroy()
        {
            if (_bike != null)
            {
                _bike.Mounted -= OnMounted;
                _bike.Dismounted -= OnDismounted;
            }
        }
    }
}
