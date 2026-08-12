using System;
using System.Collections.Generic;
using UnityEngine;

namespace Apex.Core
{
    public interface IApexService
    {
        void Initialize(ApexServices services);
        void Shutdown();
    }

    public sealed class ApexServices
    {
        private readonly Dictionary<Type, object> _services = new();

        public T Register<T>(T service) where T : class
        {
            if (service == null) throw new ArgumentNullException(nameof(service));
            _services[typeof(T)] = service;
            return service;
        }

        public bool TryGet<T>(out T service) where T : class
        {
            if (_services.TryGetValue(typeof(T), out var value) && value is T typed)
            {
                service = typed;
                return true;
            }
            service = null;
            return false;
        }

        public T Get<T>() where T : class =>
            TryGet<T>(out var service) ? service : throw new InvalidOperationException($"Apex service not registered: {typeof(T).Name}");

        public void Clear() => _services.Clear();
    }

    public static class ApexRuntime
    {
        public static ApexServices Services { get; private set; } = new();
        public static bool IsInitialized { get; private set; }

        public static void Initialize()
        {
            if (IsInitialized) return;
            Services = new ApexServices();
            IsInitialized = true;
            Application.quitting += Shutdown;
        }

        public static void Shutdown()
        {
            if (!IsInitialized) return;
            Services.Clear();
            IsInitialized = false;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStatics()
        {
            Services = new ApexServices();
            IsInitialized = false;
        }
    }

    public static class ApexMath
    {
        public static float ExpDamp(float current, float target, float sharpness, float dt)
        {
            if (dt <= 0f) return current;
            return Mathf.Lerp(current, target, 1f - Mathf.Exp(-Mathf.Max(0f, sharpness) * dt));
        }

        public static Vector3 ExpDamp(Vector3 current, Vector3 target, float sharpness, float dt)
        {
            if (dt <= 0f) return current;
            return Vector3.Lerp(current, target, 1f - Mathf.Exp(-Mathf.Max(0f, sharpness) * dt));
        }
    }
}
