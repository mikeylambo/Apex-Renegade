using System.Collections;
using System.Collections.Generic;
using Apex.Traversal;
using Apex.World;
using UnityEngine;

namespace Apex.Renegade
{
    public sealed class RenegadeWorldStreamingInstaller : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void EnsureInstaller()
        {
            if (Object.FindFirstObjectByType<RenegadeWorldStreamingInstaller>() != null) return;
            new GameObject("Apex World Streaming Installer").AddComponent<RenegadeWorldStreamingInstaller>();
        }

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            for (var i = 0; i < 120; i++)
            {
                var world = GameObject.Find("Apex Port World");
                var player = Object.FindFirstObjectByType<ApexFirstPersonMotor>();
                if (world != null && player != null)
                {
                    Install(world.transform, player.transform);
                    yield break;
                }
                yield return null;
            }
        }

        private static void Install(Transform world, Transform observer)
        {
            if (world.GetComponent<ApexWorldStreamingController>() != null) return;

            var scarContent = NewContentRoot(world, "Stream Content // The Scar");
            var expanseContent = NewContentRoot(world, "Stream Content // The Expanse");
            var verticalContent = NewContentRoot(world, "Stream Content // Vertical Megacity");

            var children = new List<Transform>();
            for (var i = 0; i < world.childCount; i++) children.Add(world.GetChild(i));
            foreach (var child in children)
            {
                if (child == scarContent || child == expanseContent || child == verticalContent) continue;
                var n = child.name;
                if (n.StartsWith("Scar Mass") || n.StartsWith("Scar Containment") || n.StartsWith("Scar Gantry") || n.StartsWith("Gantry Light"))
                    child.SetParent(scarContent, true);
                else if (n.StartsWith("Expanse Mass"))
                    child.SetParent(expanseContent, true);
                else if (n.StartsWith("Vertical Megablock") || n.StartsWith("Vertical Suspended"))
                    child.SetParent(verticalContent, true);
            }

            var controller = world.gameObject.AddComponent<ApexWorldStreamingController>();
            controller.SetObserver(observer);
            controller.Register(CreateCell(world, "scar-detail", new Vector3(0f, 0f, 250f), scarContent, 1050f, 1325f, true));
            controller.Register(CreateCell(world, "expanse-detail", new Vector3(0f, 0f, -1600f), expanseContent, 1280f, 1580f, false));
            controller.Register(CreateCell(world, "vertical-detail", new Vector3(0f, 0f, -3850f), verticalContent, 1500f, 1820f, false));
        }

        private static Transform NewContentRoot(Transform parent, string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            return go.transform;
        }

        private static ApexWorldStreamCell CreateCell(Transform world, string id, Vector3 position, Transform content, float load, float unload, bool loaded)
        {
            var go = new GameObject($"Stream Cell // {id}");
            go.transform.SetParent(world, false);
            go.transform.localPosition = position;
            var cell = go.AddComponent<ApexWorldStreamCell>();
            cell.Configure(id, content, load, unload, loaded);
            return cell;
        }
    }
}
