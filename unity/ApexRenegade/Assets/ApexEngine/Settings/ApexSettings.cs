using System;
using System.IO;
using Apex.Core;
using UnityEngine;

namespace Apex.Settings
{
    [Serializable]
    public sealed class ApexSettingsData
    {
        public float mouseSensitivity = 1f;
        public float controllerSensitivityX = 1f;
        public float controllerSensitivityY = 1f;
        public float rightStickInnerDeadzone = 0.19f;
        public float rightStickOuterDeadzone = 0.04f;
        public float rightStickCurve = 1.55f;
        public float lookAcceleration = 0.10f;
        public float adsMultiplier = 0.72f;
        public bool invertY;
        public float vibration = 1f;
        public float fov = 92f;
        public float cameraShake = 0.75f;
        public float headBob = 0.65f;
        public float weaponBob = 0.75f;
        public float screenFx = 0.8f;
        public float masterVolume = 1f;
        public float sfxVolume = 1f;
        public float musicVolume = 0.75f;
        public float dialogueVolume = 1f;
        public bool subtitles = true;
        public bool directionalDamageIndicators = true;

        public void Sanitize()
        {
            mouseSensitivity = Mathf.Clamp(mouseSensitivity, 0.1f, 5f);
            controllerSensitivityX = Mathf.Clamp(controllerSensitivityX, 0.1f, 5f);
            controllerSensitivityY = Mathf.Clamp(controllerSensitivityY, 0.1f, 5f);
            rightStickInnerDeadzone = Mathf.Clamp(rightStickInnerDeadzone, 0f, 0.6f);
            rightStickOuterDeadzone = Mathf.Clamp(rightStickOuterDeadzone, 0f, 0.4f);
            rightStickCurve = Mathf.Clamp(rightStickCurve, 1f, 3f);
            lookAcceleration = Mathf.Clamp01(lookAcceleration);
            adsMultiplier = Mathf.Clamp(adsMultiplier, 0.1f, 1f);
            vibration = Mathf.Clamp01(vibration);
            fov = Mathf.Clamp(fov, 70f, 120f);
            cameraShake = Mathf.Clamp01(cameraShake);
            headBob = Mathf.Clamp01(headBob);
            weaponBob = Mathf.Clamp01(weaponBob);
            screenFx = Mathf.Clamp01(screenFx);
            masterVolume = Mathf.Clamp01(masterVolume);
            sfxVolume = Mathf.Clamp01(sfxVolume);
            musicVolume = Mathf.Clamp01(musicVolume);
            dialogueVolume = Mathf.Clamp01(dialogueVolume);
        }
    }

    public sealed class ApexSettingsService : IApexService
    {
        private const string FileName = "apex-settings.json";
        private string _path;
        public ApexSettingsData Data { get; private set; } = new();
        public event Action<ApexSettingsData> Changed;

        public void Initialize(ApexServices services)
        {
            _path = Path.Combine(Application.persistentDataPath, FileName);
            Load();
            services.Register(this);
        }

        public void Load()
        {
            try
            {
                Data = File.Exists(_path) ? JsonUtility.FromJson<ApexSettingsData>(File.ReadAllText(_path)) ?? new ApexSettingsData() : new ApexSettingsData();
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Apex.Settings] Could not load settings: {ex.Message}");
                Data = new ApexSettingsData();
            }
            Data.Sanitize();
            Changed?.Invoke(Data);
        }

        public void Save()
        {
            Data.Sanitize();
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_path) ?? Application.persistentDataPath);
                File.WriteAllText(_path, JsonUtility.ToJson(Data, true));
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Apex.Settings] Could not save settings: {ex.Message}");
            }
            Changed?.Invoke(Data);
        }

        public void ResetToDefaults()
        {
            Data = new ApexSettingsData();
            Save();
        }

        public void Shutdown() => Save();
    }
}
