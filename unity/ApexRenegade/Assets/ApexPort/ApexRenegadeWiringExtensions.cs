using Apex.Combat;
using Apex.Input;
using Apex.Traversal;
using Apex.World;
using UnityEngine;

namespace Apex.Renegade
{
    internal static class ApexRenegadeWiringExtensions
    {
        public static void Configure(this RenegadeWeaponController controller, Camera camera, ApexInputService input, GameObject source)
        {
            controller.Configure(camera, input, source, Object.FindFirstObjectByType<ApexBikeMotor>());
        }

        public static void Configure(this ApexPortHud hud, HealthComponent health, RenegadeWeaponController weapon, ApexBikeMotor bike, ApexWorldRegionTracker regions, RenegadeLifeCycle life)
        {
            hud.Configure(health, weapon, bike, regions, life, Camera.main ?? Object.FindFirstObjectByType<Camera>());
        }
    }
}
