---
layout: default
title: Python SDK
parent: Client SDKs
nav_order: 2
---

# Python SDK

## Installation

```bash
pip install vexil
```

## Quick Start

```python
from vexil import Client

# From environment variables
client = Client(provider="env")

dark_mode = client.bool("dark-mode", default=False)
rate_limit = client.int("api-rate-limit", default=100)
banner = client.string("banner-text", default="Welcome")

print(f"dark-mode={dark_mode} rate-limit={rate_limit} banner={banner}")
```

## Providers

### Environment Variables

```python
client = Client(provider="env")
```

### Sidecar

```python
client = Client(provider="sidecar", address="localhost:8514")
```

### ConfigMap

```python
client = Client(provider="configmap", path="/etc/vexil")
```

## API

| Method | Signature | Description |
|:-------|:----------|:------------|
| `bool` | `bool(name, default=False) -> bool` | Get boolean flag |
| `string` | `string(name, default="") -> str` | Get string flag |
| `int` | `int(name, default=0) -> int` | Get integer flag |
| `json` | `json(name) -> Any` | Parse JSON flag |
| `flag` | `flag(name) -> Flag \| None` | Get raw flag object |
| `all_flags` | `all_flags() -> list[Flag]` | List all flags |

### Flag Object

```python
@dataclass
class Flag:
    name: str
    type: str       # "boolean", "string", "integer", "json"
    value: str
    disabled: bool
```
