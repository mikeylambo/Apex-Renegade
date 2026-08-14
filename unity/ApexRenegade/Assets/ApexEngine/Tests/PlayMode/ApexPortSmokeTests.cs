using System.Collections;
using Apex.Audio;
using Apex.Combat;
using Apex.Core;
using Apex.Encounter;
using Apex.Interaction;
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
            for (var i = 0; i < 5; i++) yield return null;
        }

        [UnityTest]
        public IEnumerator Bootstrap_CreatesSprintPlayableLoop()
        {
            var bootstrap = Object.FindFirstObjectByType<ApexRenegadePortBootstrap>();
            var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
            var bike = Object.FindFirstObjectByType<ApexBikeMotor>();
            var arsenal = Object.FindFirstObjectByType<RenegadeArsenalController>();
            var regions = Object.FindFirstObjectByType<ApexWorldRegionTracker>();
            var scanner = Object.FindFirstObjectByType<ApexInteractionScanner>();
            var escalation = Object.FindFirstObjectByType<RenegadeEscalationDirector>();
            var encounter = Object.FindFirstObjectByType<ApexEncounterController>();
            var spawner = Object.FindFirstObjectByType<RenegadeEncounterSpawner>();
            var pickups = Object.FindObjectsByType<RenegadePickup>(FindObjectsSortMode.None);
            var camera = Object.FindFirstObjectByType<ApexPortCameraV2>();
            var hud = Object.FindFirstObjectByType<ApexPortHudV2>();

            Assert.That(bootstrap, Is.Not.Null, "Apex bootstrap missing.");
            Assert.That(player, Is.Not.Null, "Renegade motor missing.");
            Assert.That(player.GetComponent<HealthComponent>(), Is.Not.Null, "Renegade vitals missing.");
            Assert.That(bike, Is.Not.Null, "Renegade Bike missing.");
            Assert.That(arsenal, Is.Not.Null, "Renegade arsenal missing.");
            Assert.That(arsenal.Loadout, Is.Not.Null);
            Assert.That(arsenal.Loadout.Count, Is.EqualTo(2), "Corona + Maw should exist in first loadout.");
            Assert.That(arsenal.Loadout.Find("corona-blaster"), Is.Not.Null, "Corona runtime missing.");
            Assert.That(arsenal.Loadout.Find("maw"), Is.Not.Null, "Maw runtime missing.");
            Assert.That(regions, Is.Not.Null, "World region tracker missing.");
            Assert.That(scanner, Is.Not.Null, "Interaction scanner missing.");
            Assert.That(escalation, Is.Not.Null, "Pressure/Refusal director missing.");
            Assert.That(encounter, Is.Not.Null, "Encounter Framework controller missing.");
            Assert.That(spawner, Is.Not.Null, "Encounter spawn adapter missing.");
            Assert.That(pickups.Length, Is.GreaterThanOrEqualTo(4), "First pickup set was not constructed.");
            Assert.That(camera, Is.Not.Null, "V2 cinematic camera missing.");
            Assert.That(hud, Is.Not.Null, "V2 HUD missing.");
            Assert.That(ApexRuntime.Services.TryGet<ApexSaveService>(out var save), Is.True, "Save service missing.");
            Assert.That(save.HasCheckpoint, Is.True, "Initial checkpoint was not established.");
            Assert.That(ApexRuntime.Services.TryGet<ApexAudioService>(out var audio), Is.True, "Audio service missing.");
            Assert.That(audio.HasCue("weapon.corona"), Is.True);
            Assert.That(audio.HasCue("weapon.maw"), Is.True);
            Assert.That(Resources.Load<Material>("Apex/RuntimeLit"), Is.Not.Null, "Player-safe runtime material resource missing.");

            // Auto-start encounter should have begun spawning by now.
            for (var i = 0; i < 12 && spawner.TotalSpawned == 0; i++) yield return null;
            Assert.That(spawner.TotalSpawned, Is.GreaterThan(0), "Encounter controller did not start the first response wave.");
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

        [UnityTest]
        public IEnumerator Vitals_RestoreHealthAndShieldAfterDamage()
        {
            var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
            var health = player.GetComponent<HealthComponent>();
            Assert.That(health, Is.Not.Null);

            health.ApplyDamage(new DamagePayload(70f, player.transform.position, Vector3.back, DamageKind.Energy));
            var damagedHealth = health.Health;
            var damagedShield = health.Shield;
            var shieldRestored = health.RestoreShield(20f);
            var healthRestored = health.RestoreHealth(15f);

            Assert.That(shieldRestored + healthRestored, Is.GreaterThan(0f));
            Assert.That(health.Health, Is.GreaterThanOrEqualTo(damagedHealth));
            Assert.That(health.Shield, Is.GreaterThanOrEqualTo(damagedShield));
            yield return null;
        }
    }
}
