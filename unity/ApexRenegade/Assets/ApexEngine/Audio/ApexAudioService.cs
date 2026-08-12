using System;
using System.Collections.Generic;
using Apex.Core;
using Apex.Settings;
using UnityEngine;

namespace Apex.Audio
{
    public enum ApexAudioBus { Master, Sfx, Music, Dialogue }

    public sealed class ApexAudioService : MonoBehaviour, IApexService
    {
        private readonly Dictionary<string, AudioClip> _clips = new(StringComparer.OrdinalIgnoreCase);
        private ApexSettingsService _settings;
        private AudioSource _oneShot;

        public void Initialize(ApexServices services)
        {
            _settings = services.Get<ApexSettingsService>();
            _oneShot = gameObject.GetComponent<AudioSource>() ?? gameObject.AddComponent<AudioSource>();
            _oneShot.playOnAwake = false;
            _oneShot.spatialBlend = 0f;
            BuildDefaultCueBank();
            services.Register(this);
        }

        public bool HasCue(string id) => !string.IsNullOrWhiteSpace(id) && _clips.ContainsKey(id);

        public void Register(string id, AudioClip clip)
        {
            if (string.IsNullOrWhiteSpace(id) || clip == null) return;
            _clips[id] = clip;
        }

        public void Play(string id, float volume = 1f, ApexAudioBus bus = ApexAudioBus.Sfx, float pitch = 1f)
        {
            if (!_clips.TryGetValue(id, out var clip) || clip == null || _oneShot == null) return;
            _oneShot.pitch = Mathf.Clamp(pitch, 0.35f, 2.5f);
            _oneShot.PlayOneShot(clip, Mathf.Clamp01(volume) * BusVolume(bus));
        }

        public float BusVolume(ApexAudioBus bus)
        {
            var s = _settings?.Data;
            if (s == null) return 1f;
            var child = bus switch
            {
                ApexAudioBus.Music => s.musicVolume,
                ApexAudioBus.Dialogue => s.dialogueVolume,
                ApexAudioBus.Sfx => s.sfxVolume,
                _ => 1f
            };
            return Mathf.Clamp01(s.masterVolume * child);
        }

        private void BuildDefaultCueBank()
        {
            Register("weapon.corona", Tone("Corona Shot", 0.085f, 116f, 880f, 0.55f, 0.10f));
            Register("weapon.maw", Tone("Maw Shot", 0.16f, 62f, 220f, 0.9f, 0.42f));
            Register("weapon.reload", Tone("Reload", 0.12f, 410f, 190f, 0.28f, 0.15f));
            Register("weapon.dry", Tone("Dry Fire", 0.045f, 820f, 540f, 0.22f, 0.04f));
            Register("combat.hit", Tone("Hit", 0.045f, 290f, 610f, 0.3f, 0.12f));
            Register("combat.kill", Tone("Kill", 0.11f, 260f, 960f, 0.38f, 0.08f));
            Register("player.damage", Tone("Damage", 0.12f, 92f, 175f, 0.35f, 0.35f));
            Register("bike.recall", Tone("Bike Recall", 0.34f, 130f, 520f, 0.42f, 0.08f));
            Register("bike.mount", Tone("Bike Mount", 0.12f, 180f, 480f, 0.35f, 0.08f));
            Register("bike.boost", Tone("Bike Boost", 0.28f, 95f, 710f, 0.5f, 0.18f));
            Register("pickup", Tone("Pickup", 0.10f, 440f, 920f, 0.3f, 0.02f));
            Register("ui.confirm", Tone("UI Confirm", 0.055f, 520f, 680f, 0.16f, 0.01f));
        }

        private static AudioClip Tone(string name, float seconds, float startHz, float endHz, float gain, float noise)
        {
            const int sampleRate = 44100;
            var count = Mathf.Max(64, Mathf.CeilToInt(seconds * sampleRate));
            var samples = new float[count];
            var phase = 0f;
            var rng = new System.Random(name.GetHashCode());

            for (var i = 0; i < count; i++)
            {
                var t = i / (float)Mathf.Max(1, count - 1);
                var hz = Mathf.Lerp(startHz, endHz, t);
                phase += Mathf.PI * 2f * hz / sampleRate;
                var envelope = Mathf.Pow(1f - t, 2.1f) * Mathf.Clamp01(t * 18f + 0.1f);
                var harmonic = Mathf.Sin(phase) * 0.72f + Mathf.Sin(phase * 2.03f) * 0.20f + Mathf.Sin(phase * 0.51f) * 0.08f;
                var n = ((float)rng.NextDouble() * 2f - 1f) * noise;
                samples[i] = Mathf.Clamp((harmonic + n) * gain * envelope, -1f, 1f);
            }

            var clip = AudioClip.Create(name, count, 1, sampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        public void Shutdown()
        {
            foreach (var clip in _clips.Values)
                if (clip != null) Destroy(clip);
            _clips.Clear();
        }
    }
}
