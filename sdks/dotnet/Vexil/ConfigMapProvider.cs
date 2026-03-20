using System.Text.Json;

namespace Vexil;

/// <summary>
/// Reads flags from a mounted ConfigMap path.
/// If path is a directory, each file is a flag.
/// If path is a file, it's parsed as JSON {"name": "value"}.
/// </summary>
public class ConfigMapProvider : IFlagProvider
{
    private readonly string _path;

    public ConfigMapProvider(string path = "/etc/vexil")
    {
        _path = path;
    }

    public Flag? GetFlag(string name)
    {
        if (Directory.Exists(_path))
        {
            var filePath = Path.Combine(_path, name);
            if (!File.Exists(filePath)) return null;
            var value = File.ReadAllText(filePath).Trim();
            return new Flag { Name = name, Type = "string", Value = value };
        }

        if (File.Exists(_path))
        {
            var flags = ReadJsonFile();
            return flags.TryGetValue(name, out var val)
                ? new Flag { Name = name, Type = "string", Value = val }
                : null;
        }

        return null;
    }

    public IReadOnlyList<Flag> GetAllFlags()
    {
        if (Directory.Exists(_path))
        {
            return Directory.GetFiles(_path)
                .Where(f => !Path.GetFileName(f).StartsWith('.'))
                .Select(f => new Flag
                {
                    Name = Path.GetFileName(f),
                    Type = "string",
                    Value = File.ReadAllText(f).Trim()
                })
                .ToList();
        }

        if (File.Exists(_path))
        {
            return ReadJsonFile()
                .Select(kv => new Flag { Name = kv.Key, Type = "string", Value = kv.Value })
                .ToList();
        }

        return [];
    }

    private Dictionary<string, string> ReadJsonFile()
    {
        var json = File.ReadAllText(_path);
        return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? [];
    }

    public void Dispose() { }
}
