using Microsoft.Extensions.DependencyInjection;

namespace Vexil;

/// <summary>
/// Extension methods for registering Vexil in ASP.NET Core DI.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds Vexil with environment variable provider.
    /// </summary>
    public static IServiceCollection AddVexilEnv(this IServiceCollection services)
    {
        services.AddSingleton<IFlagProvider, EnvProvider>();
        services.AddSingleton<VexilClient>();
        return services;
    }

    /// <summary>
    /// Adds Vexil with sidecar provider.
    /// </summary>
    public static IServiceCollection AddVexilSidecar(this IServiceCollection services, string address = "localhost:8514")
    {
        services.AddSingleton<IFlagProvider>(new SidecarProvider(address));
        services.AddSingleton<VexilClient>();
        return services;
    }

    /// <summary>
    /// Adds Vexil with ConfigMap provider.
    /// </summary>
    public static IServiceCollection AddVexilConfigMap(this IServiceCollection services, string path = "/etc/vexil")
    {
        services.AddSingleton<IFlagProvider>(new ConfigMapProvider(path));
        services.AddSingleton<VexilClient>();
        return services;
    }
}
