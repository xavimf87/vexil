namespace Vexil;

/// <summary>
/// Represents a resolved feature flag.
/// </summary>
public record Flag
{
    public string Name { get; init; } = string.Empty;
    public string Type { get; init; } = "string";
    public string Value { get; init; } = string.Empty;
    public bool Disabled { get; init; }
}
