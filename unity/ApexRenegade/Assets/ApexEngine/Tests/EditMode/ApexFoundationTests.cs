using Apex.Combat;
using Apex.Encounter;
using Apex.Input;
using Apex.Settings;
using NUnit.Framework;
using UnityEngine;

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
        public void InputShapeStick_RejectsDriftAndPreservesDirection()
        {
            Assert.That(ApexInputService.ShapeStick(0.10f, 0.19f, 0.04f, 1.55f), Is.Zero);
            Assert.That(ApexInputService.ShapeStick(-0.10f, 0.19f, 0.04f, 1.55f), Is.Zero);
            Assert.That(ApexInputService.ShapeStick(0.75f, 0.19f, 0.04f, 1.55f), Is.GreaterThan(0f));
            Assert.That(ApexInputService.ShapeStick(-0.75f, 0.19f, 0.04f, 1.55f), Is.LessThan(0f));

            var diagonal = ApexInputService.ShapeStick(new Vector2(0.6f, 0.6f), 0.19f, 0.04f, 1.55f);
            Assert.That(diagonal.x, Is.GreaterThan(0f));
            Assert.That(diagonal.y, Is.GreaterThan(0f));
            Assert.That(Mathf.Abs(diagonal.normalized.x - diagonal.normalized.y), Is.LessThan(0.001f));
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

        [Test]
        public void WeaponRuntime_EmitsShotReloadAndDryFireEvents()
        {
            var definition = ScriptableObject.CreateInstance<WeaponDefinition>();
            definition.magazineSize = 1;
            definition.startingReserve = 1;
            definition.roundsPerSecond = 20f;
            definition.reloadDuration = 0.25f;

            var runtime = new ApexWeaponRuntime(definition);
            var shots = 0;
            var reloadStarted = 0;
            var reloadCompleted = 0;
            var dry = 0;
            runtime.Fired += _ => shots++;
            runtime.ReloadStarted += () => reloadStarted++;
            runtime.ReloadCompleted += () => reloadCompleted++;
            runtime.DryFired += () => dry++;

            runtime.Equip();
            Assert.That(runtime.TryFire(), Is.True);
            runtime.Tick(0.06f);
            Assert.That(runtime.TryFire(), Is.False);
            Assert.That(dry, Is.EqualTo(1));
            Assert.That(runtime.TryReload(), Is.True);
            runtime.Tick(0.26f);

            Assert.That(shots, Is.EqualTo(1));
            Assert.That(reloadStarted, Is.EqualTo(1));
            Assert.That(reloadCompleted, Is.EqualTo(1));
            Assert.That(runtime.Magazine, Is.EqualTo(1));
            Assert.That(runtime.Reserve, Is.Zero);
            Object.DestroyImmediate(definition);
        }

        [Test]
        public void WeaponLoadout_SwitchesAndRoutesAmmoById()
        {
            var coronaDefinition = ScriptableObject.CreateInstance<WeaponDefinition>();
            coronaDefinition.weaponId = "corona-blaster";
            coronaDefinition.magazineSize = 18;
            coronaDefinition.startingReserve = 12;
            var mawDefinition = ScriptableObject.CreateInstance<WeaponDefinition>();
            mawDefinition.weaponId = "maw";
            mawDefinition.magazineSize = 6;
            mawDefinition.startingReserve = 3;

            var corona = new ApexWeaponRuntime(coronaDefinition);
            var maw = new ApexWeaponRuntime(mawDefinition);
            var loadout = new ApexWeaponLoadout();
            loadout.Add(corona);
            loadout.Add(maw, false);

            Assert.That(loadout.Count, Is.EqualTo(2));
            Assert.That(loadout.Active, Is.SameAs(corona));
            Assert.That(loadout.EquipNext(), Is.True);
            Assert.That(loadout.Active, Is.SameAs(maw));
            var reserveBefore = maw.Reserve;
            Assert.That(loadout.AddAmmo("maw", 9), Is.EqualTo(9));
            Assert.That(maw.Reserve, Is.EqualTo(reserveBefore + 9));
            Assert.That(loadout.EquipPrevious(), Is.True);
            Assert.That(loadout.Active, Is.SameAs(corona));

            Object.DestroyImmediate(coronaDefinition);
            Object.DestroyImmediate(mawDefinition);
        }

        [Test]
        public void EscalationMeter_CrossesAndRecoversStagesDeterministically()
        {
            var meter = new ApexEscalationMeter(
                new EscalationStage(0, "BASELINE", 0f),
                new EscalationStage(1, "RESPONSE", 0.25f),
                new EscalationStage(2, "SIEGE", 0.70f));

            Assert.That(meter.Stage.Id, Is.EqualTo("BASELINE"));
            meter.Add(0.30f);
            Assert.That(meter.Stage.Id, Is.EqualTo("RESPONSE"));
            meter.Add(0.50f);
            Assert.That(meter.Stage.Id, Is.EqualTo("SIEGE"));
            meter.Decay(0.62f);
            Assert.That(meter.Stage.Id, Is.EqualTo("BASELINE"));
            Assert.That(meter.Value, Is.EqualTo(0.18f).Within(0.001f));
        }

        [Test]
        public void AimAssistResolver_PrefersCenteredTarget()
        {
            var resolver = new ApexAimAssistResolver { MaxAngle = 12f, MaxDistance = 60f };
            var centered = new FakeAimTarget(new Vector3(0f, 0f, 20f), 0.5f);
            var edge = new FakeAimTarget(new Vector3(3.5f, 0f, 20f), 1f);
            resolver.Register(edge);
            resolver.Register(centered);

            Assert.That(resolver.TryResolve(Vector3.zero, Vector3.forward, out var solution), Is.True);
            Assert.That(solution.Target, Is.SameAs(centered));
            Assert.That(solution.AngularError, Is.LessThan(1f));
        }

        private sealed class FakeAimTarget : IAimAssistTarget
        {
            public FakeAimTarget(Vector3 point, float priority)
            {
                AimAssistPoint = point;
                AimAssistPriority = priority;
            }

            public bool AimAssistEligible => true;
            public Vector3 AimAssistPoint { get; }
            public float AimAssistPriority { get; }
        }
    }
}
