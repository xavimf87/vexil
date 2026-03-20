namespace Vexil;

/// <summary>
/// Main client for consuming Vexil feature flags.
///
/// Usage:
///   // Env var mode (reads FLAG_* environment variables)
///   using var client = new VexilClient(new EnvProvider());
///
///   // Sidecar mode (real-time via localhost:8514)
///   using var client = new VexilClient(new SidecarProvider());
///
///   // ConfigMap mode (reads mounted files)
///   using var client = new VexilClient(new ConfigMapProvider("/etc/vexil"));
///
///   var darkMode = client.Bool("dark-mode", false);
///   var rateLimit = client.Int("api-rate-limit", 100);
/// </summary>
public class VexilClient : IDisposable
{
    private readonly IFlagProvider _provider;

    public VexilClient(IFlagProvider provider)
    {
        _provider = provider;
    }

    /// <summary>Get a boolean flag value.</summary>
    public bool Bool(string name, bool defaultValue = false)
    {
        var flag = _provider.GetFlag(name);
        if (flag is null || flag.Disabled) return defaultValue;
        return bool.TryParse(flag.Value, out var result) ? result : defaultValue;
    }

    /// <summary>Get a string flag value.</summary>
    public string String(string name, string defaultValue = "")
    {
        var flag = _provider.GetFlag(name);
        if (flag is null || flag.Disabled) return defaultValue;
        return flag.Value;
    }

    /// <summary>Get an integer flag value.</summary>
    public int Int(string name, int defaultValue = 0)
    {
        var flag = _provider.GetFlag(name);
        if (flag is null || flag.Disabled) return defaultValue;
        return int.TryParse(flag.Value, out var result) ? result : defaultValue;
    }

    /// <summary>Get a double flag value.</summary>
    public double Double(string name, double defaultValue = 0)
    {
        var flag = _provider.GetFlag(name);
        if (flag is null || flag.Disabled) return defaultValue;
        return double.TryParse(flag.Value, out var result) ? result : defaultValue;
    }

    /// <summary>Deserialize a JSON flag value.</summary>
    public T? Json<T>(string name) where T : class
    {
        var flag = _provider.GetFlag(name);
        if (flag is null || flag.Disabled) return null;
        return System.Text.Json.JsonSerializer.Deserialize<T>(flag.Value);
    }

    /// <summary>Get the raw Flag object.</summary>
    public Flag? GetFlag(string name) => _provider.GetFlag(name);

    /// <summary>Get all available flags.</summary>
    public IReadOnlyList<Flag> GetAllFlags() => _provider.GetAllFlags();

    public void Dispose() => _provider.Dispose();
}
