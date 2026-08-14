using System.Collections;
using UnityEngine;

namespace Apex.Renegade
{
    [DefaultExecutionOrder(-520)]
    public sealed class RenegadeTerrainIntegration : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureIntegration()
        {
            if (Object.FindFirstObjectByType<RenegadeTerrainIntegration>() != null) return;
            new GameObject("Apex Terrain Integration").AddComponent<RenegadeTerrainIntegration>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 180; i++)
            {
                var terrain = Object.FindFirstObjectByType<Terrain>();
                var safety = GameObject.Find("Expanse Ground");
                if (terrain != null && terrain.terrainData != null && safety != null)
                {
                    // The prototype slab previously topped out at y=0, exactly matching
                    // the new TerrainCollider's flat road corridor. Lower it so Unity
                    // Terrain is the sole normal drive surface while the slab remains a
                    // forgiving catch layer beneath the authored geography.
                    var p = safety.transform.position;
                    p.y = -2.55f;
                    safety.transform.position = p;
                    if (safety.TryGetComponent<Renderer>(out var renderer)) renderer.enabled = false;
                    yield break;
                }
                yield return null;
            }
        }
    }
}
