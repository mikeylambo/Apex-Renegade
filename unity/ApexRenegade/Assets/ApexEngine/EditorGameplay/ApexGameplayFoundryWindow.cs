using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Apex.Combat;
using Apex.Encounter;
using UnityEditor;
using UnityEngine;

namespace Apex.GameplayFoundry
{
    public sealed class ApexGameplayFoundryWindow : EditorWindow
    {
        private Vector2 _scroll;
        private string _report = "Run a gameplay audit to inspect reusable Apex content assets.";

        [MenuItem("Apex/Gameplay Foundry")]
        public static void Open() => GetWindow<ApexGameplayFoundryWindow>("Apex Gameplay Foundry");

        private void OnGUI()
        {
            EditorGUILayout.Space(8f);
            EditorGUILayout.LabelField("APEX GAMEPLAY FOUNDRY", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "Audit reusable weapon and encounter data before it reaches runtime. " +
                "Balance output is deliberately data-oriented so autonomous passes can compare changes instead of guessing from C# constants.",
                MessageType.Info);

            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Audit Gameplay Data", GUILayout.Height(30f))) _report = ApexGameplayAudit.BuildReport();
                if (GUILayout.Button("Write Balance CSV", GUILayout.Height(30f))) WriteBalanceCsv();
                if (GUILayout.Button("Write Audit TXT", GUILayout.Height(30f))) WriteAuditText();
            }

            EditorGUILayout.Space(8f);
            _scroll = EditorGUILayout.BeginScrollView(_scroll);
            EditorGUILayout.TextArea(_report, GUILayout.ExpandHeight(true));
            EditorGUILayout.EndScrollView();
        }

        private void WriteBalanceCsv()
        {
            const string dir = "Assets/ApexReports";
            Directory.CreateDirectory(dir);
            var path = $"{dir}/weapon-balance.csv";
            File.WriteAllText(path, ApexGameplayAudit.BuildWeaponCsv());
            AssetDatabase.ImportAsset(path);
            Selection.activeObject = AssetDatabase.LoadAssetAtPath<TextAsset>(path);
        }

        private void WriteAuditText()
        {
            const string dir = "Assets/ApexReports";
            Directory.CreateDirectory(dir);
            var path = $"{dir}/gameplay-audit.txt";
            if (string.IsNullOrWhiteSpace(_report)) _report = ApexGameplayAudit.BuildReport();
            File.WriteAllText(path, _report);
            AssetDatabase.ImportAsset(path);
            Selection.activeObject = AssetDatabase.LoadAssetAtPath<TextAsset>(path);
        }
    }

    public static class ApexGameplayAudit
    {
        public static WeaponDefinition[] LoadWeapons() => LoadAll<WeaponDefinition>();
        public static EncounterDefinition[] LoadEncounters() => LoadAll<EncounterDefinition>();

        public static string BuildReport()
        {
            var weapons = LoadWeapons();
            var encounters = LoadEncounters();
            var report = new StringBuilder(8192);
            var issues = new List<string>();

            report.AppendLine("APEX GAMEPLAY FOUNDRY // DATA AUDIT");
            report.AppendLine($"Unity: {Application.unityVersion}");
            report.AppendLine($"Weapon definitions: {weapons.Length}");
            report.AppendLine($"Encounter definitions: {encounters.Length}");
            report.AppendLine();

            var duplicateWeaponIds = weapons
                .Where(w => w != null)
                .GroupBy(w => Normalize(w.weaponId), StringComparer.OrdinalIgnoreCase)
                .Where(g => !string.IsNullOrWhiteSpace(g.Key) && g.Count() > 1)
                .ToArray();
            foreach (var group in duplicateWeaponIds)
                issues.Add($"Duplicate weapon id '{group.Key}' across {group.Count()} assets.");

            report.AppendLine("WEAPONS");
            foreach (var weapon in weapons.OrderBy(w => w != null ? w.weaponId : "~"))
            {
                if (weapon == null) continue;
                var id = Normalize(weapon.weaponId);
                var damagePerShot = weapon.damage * Mathf.Max(1, weapon.pellets);
                var theoreticalDps = damagePerShot * Mathf.Max(0.01f, weapon.roundsPerSecond);
                var magazineDamage = damagePerShot * Mathf.Max(1, weapon.magazineSize);
                var burstSeconds = weapon.magazineSize / Mathf.Max(0.01f, weapon.roundsPerSecond);
                report.AppendLine($"  {id,-24} mag={weapon.magazineSize,3} reserve={weapon.startingReserve,4} rps={weapon.roundsPerSecond,5:0.00} reload={weapon.reloadDuration,5:0.00}s pellets={weapon.pellets,2} dmg/trigger={damagePerShot,6:0.0} dps≈{theoreticalDps,7:0.0} range={weapon.range,6:0.0}m spread={weapon.spreadDegrees,5:0.00}°");

                if (string.IsNullOrWhiteSpace(id)) issues.Add($"Weapon asset '{weapon.name}' has no weaponId.");
                if (weapon.magazineSize <= 0) issues.Add($"{id}: magazineSize must be > 0.");
                if (weapon.roundsPerSecond <= 0f) issues.Add($"{id}: roundsPerSecond must be > 0.");
                if (weapon.reloadDuration <= 0f) issues.Add($"{id}: reloadDuration must be > 0.");
                if (weapon.range <= 0f) issues.Add($"{id}: range must be > 0.");
                if (weapon.damage <= 0f) issues.Add($"{id}: damage is non-positive.");
                if (weapon.pellets <= 0) issues.Add($"{id}: pellets must be > 0.");
                if (burstSeconds < 0.08f) issues.Add($"{id}: entire magazine empties in < 80 ms; likely bad cadence data.");
                if (magazineDamage <= 0f) issues.Add($"{id}: magazine damage is non-positive.");
            }

            report.AppendLine();
            report.AppendLine("ENCOUNTERS");
            var encounterIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var encounter in encounters.OrderBy(e => e != null ? e.encounterId : "~"))
            {
                if (encounter == null) continue;
                var id = Normalize(encounter.encounterId);
                if (!encounterIds.Add(id)) issues.Add($"Duplicate encounter id '{id}'.");
                report.AppendLine($"  {id,-28} waves={encounter.waves?.Count ?? 0} autoStart={encounter.autoStart}");
                if (encounter.waves == null || encounter.waves.Count == 0)
                {
                    issues.Add($"{id}: encounter has no waves.");
                    continue;
                }

                for (var i = 0; i < encounter.waves.Count; i++)
                {
                    var wave = encounter.waves[i];
                    if (wave == null)
                    {
                        issues.Add($"{id}: wave {i} is null.");
                        continue;
                    }
                    report.AppendLine($"    [{i}] {wave.id,-18} count={wave.targetCount,3} maxLive={wave.maxSimultaneous,3} delay={wave.reinforcementDelay,5:0.00}s archetype={wave.archetypeTag}");
                    if (wave.targetCount <= 0) issues.Add($"{id}/{wave.id}: targetCount must be > 0.");
                    if (wave.maxSimultaneous <= 0) issues.Add($"{id}/{wave.id}: maxSimultaneous must be > 0.");
                    if (wave.maxSimultaneous > wave.targetCount && wave.targetCount > 0)
                        issues.Add($"{id}/{wave.id}: maxSimultaneous exceeds total target count; harmless but likely unintended.");
                    if (string.IsNullOrWhiteSpace(wave.archetypeTag)) issues.Add($"{id}/{wave.id}: archetype tag is empty.");
                }
            }

            report.AppendLine();
            report.AppendLine($"ISSUES: {issues.Count}");
            foreach (var issue in issues) report.AppendLine($"  - {issue}");
            if (issues.Count == 0) report.AppendLine("  NONE // gameplay data passes structural audit.");
            return report.ToString();
        }

        public static string BuildWeaponCsv()
        {
            var weapons = LoadWeapons();
            var csv = new StringBuilder();
            csv.AppendLine("weapon_id,display_name,magazine,reserve,rounds_per_second,reload_seconds,pellets,damage_per_pellet,damage_per_trigger,theoretical_dps,range_m,spread_deg,ads_fov,recoil_pitch,recoil_yaw,damage_kind");
            foreach (var weapon in weapons.OrderBy(w => w != null ? w.weaponId : "~"))
            {
                if (weapon == null) continue;
                var trigger = weapon.damage * Mathf.Max(1, weapon.pellets);
                var dps = trigger * Mathf.Max(0.01f, weapon.roundsPerSecond);
                csv.Append(Escape(weapon.weaponId)).Append(',')
                    .Append(Escape(weapon.displayName)).Append(',')
                    .Append(weapon.magazineSize).Append(',')
                    .Append(weapon.startingReserve).Append(',')
                    .Append(F(weapon.roundsPerSecond)).Append(',')
                    .Append(F(weapon.reloadDuration)).Append(',')
                    .Append(weapon.pellets).Append(',')
                    .Append(F(weapon.damage)).Append(',')
                    .Append(F(trigger)).Append(',')
                    .Append(F(dps)).Append(',')
                    .Append(F(weapon.range)).Append(',')
                    .Append(F(weapon.spreadDegrees)).Append(',')
                    .Append(F(weapon.adsFov)).Append(',')
                    .Append(F(weapon.recoilPitch)).Append(',')
                    .Append(F(weapon.recoilYaw)).Append(',')
                    .Append(weapon.damageKind).AppendLine();
            }
            return csv.ToString();
        }

        private static T[] LoadAll<T>() where T : UnityEngine.Object
        {
            return AssetDatabase.FindAssets($"t:{typeof(T).Name}")
                .Select(guid => AssetDatabase.GUIDToAssetPath(guid))
                .Select(AssetDatabase.LoadAssetAtPath<T>)
                .Where(asset => asset != null)
                .ToArray();
        }

        private static string Normalize(string value) => string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
        private static string F(float value) => value.ToString("0.####", CultureInfo.InvariantCulture);
        private static string Escape(string value)
        {
            value ??= string.Empty;
            if (!value.Contains(',') && !value.Contains('"') && !value.Contains('\n')) return value;
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
    }
}
