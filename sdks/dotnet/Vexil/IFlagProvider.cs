namespace Vexil;

/// <summary>
/// Reads flag values from a source.
/// </summary>
public interface IFlagProvider : IDisposable
{
    Flag? GetFlag(string name);
    IReadOnlyList<Flag> GetAllFlags();
}
