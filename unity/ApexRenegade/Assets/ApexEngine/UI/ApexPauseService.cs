using System;
using Apex.Core;
using Apex.Settings;
using UnityEngine;

namespace Apex.UI
{
    public sealed class ApexPauseService : IApexService
    {
        private ApexSettingsService _settings;
        private float _previousTimeScale = 1f;

        public bool IsPaused { get; private set; }
        public bool SettingsOpen { get; private set; }
        public event Action<bool> PauseChanged;
        public event Action<bool> SettingsVisibilityChanged;

        public void Initialize(ApexServices services)
        {
            _settings = services.Get<ApexSettingsService>();
            services.Register(this);
        }

        public void TogglePause() => SetPaused(!IsPaused);

        public void SetPaused(bool paused)
        {
            if (IsPaused == paused) return;
            IsPaused = paused;
            if (paused)
            {
                _previousTimeScale = Mathf.Approximately(Time.timeScale, 0f) ? 1f : Time.timeScale;
                Time.timeScale = 0f;
            }
            else
            {
                Time.timeScale = Mathf.Max(0.0001f, _previousTimeScale);
                SetSettingsOpen(false);
            }
            PauseChanged?.Invoke(IsPaused);
        }

        public void SetSettingsOpen(bool open)
        {
            if (!IsPaused && open) SetPaused(true);
            if (SettingsOpen == open) return;
            SettingsOpen = open;
            SettingsVisibilityChanged?.Invoke(open);
        }

        public void ApplyAndSaveSettings()
        {
            _settings?.Save();
        }

        public void ResetSettings()
        {
            _settings?.ResetToDefaults();
        }

        public void Shutdown()
        {
            if (IsPaused) Time.timeScale = Mathf.Max(0.0001f, _previousTimeScale);
            IsPaused = false;
            SettingsOpen = false;
        }
    }
}
