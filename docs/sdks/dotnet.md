---
layout: default
title: .NET SDK
parent: Client SDKs
nav_order: 4
---

# .NET SDK

## Installation

```bash
dotnet add package Vexil
```

## Quick Start

```csharp
using Vexil;

// From environment variables
using var client = new VexilClient(new EnvProvider());

var darkMode = client.Bool("dark-mode", false);
var rateLimit = client.Int("api-rate-limit", 100);
var banner = client.String("banner-text", "Welcome");

Console.WriteLine($"dark-mode={darkMode} rate-limit={rateLimit} banner={banner}");
```

## Providers

### Environment Variables

```csharp
using var client = new VexilClient(new EnvProvider());
```

### Sidecar

```csharp
using var client = new VexilClient(new SidecarProvider("http://localhost:8514"));
```

### ConfigMap

```csharp
using var client = new VexilClient(new ConfigMapProvider("/etc/vexil"));
```

## ASP.NET Core Dependency Injection

Register Vexil in `Program.cs`:

```csharp
// Choose one provider:
builder.Services.AddVexilEnv();          // Environment variables
builder.Services.AddVexilSidecar();      // Sidecar API
builder.Services.AddVexilConfigMap();    // Mounted ConfigMap

// Inject in your services:
public class MyService(VexilClient vexil)
{
    public void DoWork()
    {
        if (vexil.Bool("dark-mode"))
            EnableDarkMode();

        var limit = vexil.Int("api-rate-limit", 100);
    }
}
```

## API

| Method | Signature | Description |
|:-------|:----------|:------------|
| `Bool` | `Bool(name, defaultValue = false) -> bool` | Get boolean flag |
| `String` | `String(name, defaultValue = "") -> string` | Get string flag |
| `Int` | `Int(name, defaultValue = 0) -> int` | Get integer flag |
| `Double` | `Double(name, defaultValue = 0) -> double` | Get double flag |
| `Json<T>` | `Json<T>(name) -> T?` | Deserialize JSON flag |
| `GetFlag` | `GetFlag(name) -> Flag?` | Get raw flag |
| `GetAllFlags` | `GetAllFlags() -> IReadOnlyList<Flag>` | List all flags |

### Flag Model

```csharp
public class Flag
{
    public string Name { get; set; }
    public string Type { get; set; }     // "boolean", "string", "integer", "json"
    public string Value { get; set; }
    public bool Disabled { get; set; }
}
```

### Custom Provider

```csharp
public interface IFlagProvider : IDisposable
{
    Flag? GetFlag(string name);
    IReadOnlyList<Flag> GetAllFlags();
}
```
