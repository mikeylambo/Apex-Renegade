using Apex.Combat;
using Apex.Settings;
using NUnit.Framework;

namespace Apex.Tests
{
    public sealed class ApexFoundationTests
    {
        [Test]
        public void SettingsSanitize_ClampsUnsafeValues()
        {
            var settings = new ApexSettingsData
            {
                rightStickInnerDeadzone = -1f,
                rightStickOuterDeadzone = 2f,
                fov = 400f,
                vibration = 3f
            };
            settings.Sanitize();
            Assert.That(settings.rightStickInnerDeadzone, Is.InRange(0f, 0.6f));
            Assert.That(settings.rightStickOuterDeadzone, Is.InRange(0f, 0.4f));
            Assert.That(settings.fov, Is.EqualTo(120f));
            Assert.That(settings.vibration, Is.EqualTo(1f));
        }

        [Test]
        public void WeaponStateMachine_FireReloadCycle_IsDeterministic()
        {
            var weapon = new WeaponStateMachine(3, 6, 10f, 1f);
            weapon.Equip();
            Assert.That(weapon.TryFire(), Is.True);
            weapon.Tick(0.11f);
            Assert.That(weapon.TryFire(), Is.True);
            weapon.Tick(0.11f);
            Assert.That(weapon.TryFire(), Is.True);
            Assert.That(weapon.Magazine, Is.Zero);
            Assert.That(weapon.TryReload(), Is.True);
            weapon.Tick(1.01f);
            Assert.That(weapon.Magazine, Is.EqualTo(3));
            Assert.That(weapon.Reserve, Is.EqualTo(3));
            Assert.That(weapon.State, Is.EqualTo(WeaponState.Ready));
        }
    }
}
