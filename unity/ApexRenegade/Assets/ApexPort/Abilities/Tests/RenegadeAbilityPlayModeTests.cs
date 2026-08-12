using System.Collections;
using Apex.Abilities;
using Apex.Renegade.Abilities;
using Apex.Traversal;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Apex.Renegade.Abilities.Tests
{
    public sealed class RenegadeAbilityPlayModeTests
    {
        [UnityTest]
        public IEnumerator FlightAndSurge_AutoInstallIntoPlayableRuntime()
        {
            if (Object.FindFirstObjectByType<ApexRenegadePortBootstrap>() == null)
                new GameObject("Apex Ability Test Bootstrap").AddComponent<ApexRenegadePortBootstrap>();

            ApexFirstPersonMotor player = null;
            ApexFlightController flight = null;
            RenegadeApexSurge surge = null;
            for (var i = 0; i < 120; i++)
            {
                player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                flight = Object.FindFirstObjectByType<ApexFlightController>();
                surge = Object.FindFirstObjectByType<RenegadeApexSurge>();
                if (player != null && flight != null && surge != null) break;
                yield return null;
            }

            Assert.That(player, Is.Not.Null);
            Assert.That(flight, Is.Not.Null, "Reusable flight controller was not installed.");
            Assert.That(surge, Is.Not.Null, "Apex Surge ability was not installed.");
            Assert.That(surge.Charge, Is.Not.Null);
            Assert.That(surge.Surge, Is.Not.Null);

            flight.SetFlight(true);
            Assert.That(flight.IsFlying, Is.True);
            Assert.That(player.enabled, Is.False, "Ground motor should yield movement ownership while flying.");
            flight.SetFlight(false);
            Assert.That(flight.IsFlying, Is.False);
            Assert.That(player.enabled, Is.True);

            surge.Charge.Set(1f);
            Assert.That(surge.Charge.Full, Is.True);
            Assert.That(surge.Charge.TryConsume(), Is.True);
            Assert.That(surge.Charge.Value, Is.Zero);
        }
    }
}
