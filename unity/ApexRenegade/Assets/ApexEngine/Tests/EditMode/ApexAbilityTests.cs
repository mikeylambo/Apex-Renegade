using Apex.Abilities;
using NUnit.Framework;

namespace Apex.Tests.Abilities
{
    public sealed class ApexAbilityTests
    {
        [Test]
        public void ChargeMeter_FillsConsumesAndClamps()
        {
            var meter = new ApexChargeMeter();
            var fills = 0;
            meter.Filled += () => fills++;
            meter.Add(0.42f);
            meter.Add(0.70f);
            Assert.That(meter.Value, Is.EqualTo(1f));
            Assert.That(meter.Full, Is.True);
            Assert.That(fills, Is.EqualTo(1));
            Assert.That(meter.TryConsume(), Is.True);
            Assert.That(meter.Value, Is.Zero);
            Assert.That(meter.TryConsume(), Is.False);
        }

        [Test]
        public void AbilityRuntime_ActivatesExpiresAndRecoversCooldown()
        {
            var ability = new ApexAbilityRuntime("test", 1.5f, 0.5f);
            var activations = 0;
            var endings = 0;
            ability.Activated += () => activations++;
            ability.Ended += () => endings++;

            Assert.That(ability.TryActivate(), Is.True);
            Assert.That(ability.Active, Is.True);
            Assert.That(ability.TryActivate(), Is.False);
            ability.Tick(0.51f);
            Assert.That(ability.Active, Is.False);
            Assert.That(endings, Is.EqualTo(1));
            Assert.That(ability.Ready, Is.False);
            ability.Tick(1.01f);
            Assert.That(ability.Ready, Is.True);
            Assert.That(activations, Is.EqualTo(1));
        }
    }
}
