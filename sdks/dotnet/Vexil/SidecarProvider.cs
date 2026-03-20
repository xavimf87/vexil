using System.Net.Http.Json;
using System.Text.Json;

namespace Vexil;

/// <summary>
/// Connects to the Vexil sidecar HTTP API at localhost:8514.
/// </summary>
public class SidecarProvider : IFlagProvider
{
    private readonly HttpClient _client;
    private readonly string _baseUrl;

    public SidecarProvider(string address = "localhost:8514")
    {
        _baseUrl = address.StartsWith("http") ? address : $"http://{address}";
        _client = new HttpClient
        {
            BaseAddress = new Uri(_baseUrl),
            Timeout = TimeSpan.FromSeconds(5)
        };
    }

    public Flag? GetFlag(string name)
    {
        try
        {
            var response = _client.GetAsync($"/flags/{name}").GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode) return null;

            var json = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return JsonSerializer.Deserialize<Flag>(json, JsonOpts);
        }
        catch
        {
            return null;
        }
    }

    public IReadOnlyList<Flag> GetAllFlags()
    {
        try
        {
            var response = _client.GetAsync("/flags").GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode) return [];

            var json = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return JsonSerializer.Deserialize<List<Flag>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public void Dispose() => _client.Dispose();

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };
}
