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
        [SerializeField] private GameObject actor;
        [SerializeField] private float range = 4.5f;
        [SerializeField] private float radius = 0.22f;
        [SerializeField] private LayerMask mask = ~0;

        public ApexInputService Input { get; set; }
        public IApexInteractable Focused { get; private set; }
        public InteractionPrompt? CurrentPrompt { get; private set; }
        public event Action<InteractionPrompt?> PromptChanged;
        public event Action<IApexInteractable> Interacted;

        public void Configure(ApexInputService input, Transform rayOrigin, GameObject interactionActor = null, float scanRange = 4.5f, float scanRadius = 0.22f)
        {
            Input = input;
            origin = rayOrigin;
            actor = interactionActor != null ? interactionActor : gameObject;
            range = Mathf.Max(0.5f, scanRange);
            radius = Mathf.Clamp(scanRadius, 0.01f, 1f);
        }

        private void Update()
        {
            if (Time.timeScale <= 0f || Input == null) return;
            var source = origin != null ? origin : transform;
            var interactionActor = actor != null ? actor : gameObject;
            IApexInteractable next = null;

            if (Physics.SphereCast(source.position, radius, source.forward, out var hit, range, mask, QueryTriggerInteraction.Collide))
                next = hit.collider.GetComponentInParent<IApexInteractable>();

            if (next != null && !next.CanInteract(interactionActor)) next = null;
            if (!ReferenceEquals(next, Focused))
            {
                Focused = next;
                CurrentPrompt = Focused?.GetPrompt(interactionActor);
                PromptChanged?.Invoke(CurrentPrompt);
            }

            if (Focused != null && Input.Pressed(Input.Interact))
            {
                var interacted = Focused;
                interacted.Interact(interactionActor);
                Interacted?.Invoke(interacted);
                // Force a refresh after one-shot pickups disable/destroy themselves.
                Focused = null;
                CurrentPrompt = null;
                PromptChanged?.Invoke(null);
            }
        }
    }
}
