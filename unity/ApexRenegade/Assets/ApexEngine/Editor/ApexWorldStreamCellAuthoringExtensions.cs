using UnityEngine;

namespace Apex.World
{
    /// <summary>
    /// Editor-only convenience overload used by Apex World Foundry. Runtime
    /// streaming cells always own an explicit content root; authoring can ask
    /// the Foundry to create that root automatically.
    /// </summary>
    public static class ApexWorldStreamCellAuthoringExtensions
    {
        public static void Configure(this ApexWorldStreamCell cell, string id, float loadDistance, float unloadDistance)
        {
            if (cell == null) return;
            var content = new GameObject($"Content // {id}");
            content.transform.SetParent(cell.transform, false);
            cell.Configure(id, content.transform, loadDistance, unloadDistance, true);
        }
    }
}
