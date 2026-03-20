namespace Vexil;

/// <summary>
/// Reads flags from environment variables.
/// Flag name "dark-mode" maps to env var "FLAG_DARK_MODE".
/// </summary>
public class EnvProvider : IFlagProvider
{
    private static string FlagNameToEnvVar(string name)
        => "FLAG_" + name.ToUpperInvariant().Replace('-', '_');

    public Flag? GetFlag(string name)
    {
        var envName = FlagNameToEnvVar(name);
        var value = Environment.GetEnvironmentVariable(envName);
        if (value is null) return null;

        return new Flag
        {
            Name = name,
            Type = "string",
            Value = value
        };
    }

    public IReadOnlyList<Flag> GetAllFlags()
    {
        var flags = new List<Flag>();
        foreach (var entry in Environment.GetEnvironmentVariables())
        {
            if (entry is System.Collections.DictionaryEntry de
                && de.Key is string key
                && de.Value is string val
                && key.StartsWith("FLAG_"))
            {
                var name = key[5..].ToLowerInvariant().Replace('_', '-');
                flags.Add(new Flag { Name = name, Type = "string", Value = val });
            }
        }
        return flags;
    }

    public void Dispose() { }
}
