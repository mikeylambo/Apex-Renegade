using System;
using Apex.Input;
using UnityEngine;

namespace Apex.Interaction
{
    public readonly struct InteractionPrompt
    {
        public readonly string Action;
        public readonly string Label;
        public readonly float HoldDuration;

        public InteractionPrompt(string action, string label, float holdDuration = 0f)
        {
            Action = action;
            Label = label;
            HoldDuration = Mathf.Max(0f, holdDuration);
        }
    }

    public interface IApexInteractable
    {
        bool CanInteract(GameObject actor);
        InteractionPrompt GetPrompt(GameObject actor);
        void Interact(GameObject actor);
    }

    public sealed class ApexInteractionScanner : MonoBehaviour
    {
        [SerializeField] private Transform origin;
        [SerializeField] private float range = 4.5f;
        [SerializeField] private float radius = 0.22f;
        [SerializeField] private LayerMask mask = ~0;
        public ApexInputService Input { get; set; }
        public IApexInteractable Focused { get; private set; }
        public InteractionPrompt? CurrentPrompt { get; private set; }
        public event Action<InteractionPrompt?> PromptChanged;

        private void Update()
        {
            if (Input == null) return;
            var source = origin != null ? origin : transform;
            IApexInteractable next = null;
            if (Physics.SphereCast(source.position, radius, source.forward, out var hit, range, mask, QueryTriggerInteraction.Collide))
                next = hit.collider.GetComponentInParent<IApexInteractable>();

            if (next != null && !next.CanInteract(gameObject)) next = null;
            if (!ReferenceEquals(next, Focused))
            {
                Focused = next;
                CurrentPrompt = Focused?.GetPrompt(gameObject);
                PromptChanged?.Invoke(CurrentPrompt);
            }

            if (Focused != null && Input.Pressed(Input.Interact))
                Focused.Interact(gameObject);
        }
    }
}
