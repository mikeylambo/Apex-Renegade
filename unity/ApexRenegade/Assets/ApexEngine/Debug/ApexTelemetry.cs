using UnityEngine;

namespace Apex.Debugging
{
    public sealed class ApexTelemetry : MonoBehaviour
    {
        public float SmoothedFrameMs { get; private set; } = 16.67f;
        public float SmoothedFps => 1000f / Mathf.Max(0.01f, SmoothedFrameMs);
        public int FrameCount { get; private set; }

        private void Update()
        {
            var sample = Mathf.Min(100f, Time.unscaledDeltaTime * 1000f);
            SmoothedFrameMs = Mathf.Lerp(SmoothedFrameMs, sample, 1f - Mathf.Exp(-3f * Time.unscaledDeltaTime));
            FrameCount++;
        }
    }
}
