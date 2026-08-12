using System.Collections;
using Apex.Combat;
using Apex.Core;
using Apex.Renegade;
using Apex.Save;
using Apex.Traversal;
using Apex.World;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Apex.Tests.PlayMode
{
    public sealed class ApexPortSmokeTests
    {
        [UnitySetUp]
        public IEnumerator EnsurePlayableBootstrap()
        {
            Time.timeScale = 1f;
            var bootstrap = Object.FindFirstObjectByType<ApexRenegadePortBootstrap>();
            if (bootstrap == null)
                new GameObject("Apex Test Bootstrap").AddComponent<ApexRenegadePortBootstrap>();
            yield return null;
            yield return null;
        }

        [UnityTest]
        public IEnumerator Bootstrap_CreatesCorePlayableLoop()
        {
            var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
            var bike = Object.FindFirstObjectByType<ApexBikeMotor>();
            var weapon = Object.FindFirstObjectByType<RenegadeWeaponController>();
            var regions = Object.FindFirstObjectByType<ApexWorldRegionTracker>();
            var hollows = Object.FindObjectsByType<ApexPortEnemy>(FindObjectsSortMode.None);

            Assert.That(player, Is.Not.Null, "Renegade motor missing.");
            Assert.That(player.GetComponent<HealthComponent>(), Is.Not.Null, "Renegade vitals missing.");
            Assert.That(bike, Is.Not.Null, "Renegade Bike missing.");
            Assert.That(weapon, Is.Not.Null, "Corona controller missing.");
            Assert.That(weapon.Weapon, Is.Not.Null, "Corona runtime missing.");
            Assert.That(weapon.Weapon.Definition.displayName, Is.EqualTo("Corona Blaster"));
            Assert.That(regions, Is.Not.Null, "World region tracker missing.");
            Assert.That(hollows.Length, Is.GreaterThanOrEqualTo(6), "First Hollow encounter was not constructed.");
            Assert.That(ApexRuntime.Services.TryGet<ApexSaveService>(out var save), Is.True, "Save service missing.");
            Assert.That(save.HasCheckpoint, Is.True, "Initial checkpoint was not established.");

            yield return null;
        }

        [UnityTest]
        public IEnumerator BikeRecall_ClosesDistanceToRenegade()
        {
            var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
            var bike = Object.FindFirstObjectByType<ApexBikeMotor>();
            Assert.That(player, Is.Not.Null);
            Assert.That(bike, Is.Not.Null);

            if (bike.IsMounted) bike.Dismount();
            bike.transform.position = player.transform.position + new Vector3(34f, 0f, 18f);
            if (bike.TryGetComponent<Rigidbody>(out var body))
            {
                body.isKinematic = false;
                body.velocity = Vector3.zero;
            }

            var before = Vector3.Distance(player.transform.position, bike.transform.position);
            bike.Recall();
            for (var i = 0; i < 12; i++) yield return null;
            var after = Vector3.Distance(player.transform.position, bike.transform.position);

            Assert.That(bike.IsRecalling || after < 4f, Is.True, "Recall did not enter an active/arrived state.");
            Assert.That(after, Is.LessThan(before - 0.25f), "Recall did not move the bike toward the Renegade.");
        }
    }
}
