using UnityEngine;

namespace Apex.Renegade
{
    public static class ApexBuildInfo
    {
        private const string ResourcePath = "Apex/BuildInfo";
        private static string _text;

        public static string Text
        {
            get
            {
                if (_text != null) return _text;
                var asset = Resources.Load<TextAsset>(ResourcePath);
                _text = asset != null ? asset.text.Trim() : "build=local\ncommit=unknown\nrun=local";
                return _text;
            }
        }

        public static string Value(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return string.Empty;
            var prefix = key.Trim() + "=";
            var lines = Text.Split('\n');
            for (var i = 0; i < lines.Length; i++)
            {
                var line = lines[i].Trim();
                if (line.StartsWith(prefix, System.StringComparison.OrdinalIgnoreCase))
                    return line.Substring(prefix.Length).Trim();
            }
            return string.Empty;
        }

        public static string ShortCommit
        {
            get
            {
                var commit = Value("commit");
                return commit.Length > 10 ? commit.Substring(0, 10) : commit;
            }
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void Reset() => _text = null;
    }
}
