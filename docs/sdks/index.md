---
layout: default
title: Client SDKs
nav_order: 5
has_children: true
---

# Client SDKs

Vexil provides client SDKs for reading feature flags from your application code. All SDKs follow the same pattern:

1. Initialize a client with a provider (env, sidecar, or configmap)
2. Call typed methods: `Bool()`, `String()`, `Int()`, `JSON()`
3. Get the default value back if the flag is not found or disabled

## Providers

| Provider | Source | Use When |
|:---------|:-------|:---------|
| **env** | `FLAG_*` environment variables | Flags delivered via envVar |
| **sidecar** | HTTP to localhost:8514 | Flags delivered via sidecar |
| **configmap** | Mounted files from a directory | Flags delivered via configMap |

## Quick Comparison

```go
// Go
client, _ := vexil.New(vexil.WithEnvProvider())
darkMode := client.Bool("dark-mode", false)
```

```python
# Python
client = Client(provider="env")
dark_mode = client.bool("dark-mode", default=False)
```

```typescript
// Node.js
const client = new Client({ provider: 'env' });
const darkMode = await client.bool('dark-mode', false);
```

```csharp
// .NET
using var client = new VexilClient(new EnvProvider());
var darkMode = client.Bool("dark-mode", false);
```
