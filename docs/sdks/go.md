---
layout: default
title: Go SDK
parent: Client SDKs
nav_order: 1
---

# Go SDK

## Installation

```bash
go get github.com/vexil-platform/vexil/sdks/go/vexil
```

## Quick Start

```go
package main

import (
    "fmt"
    "github.com/vexil-platform/vexil/sdks/go/vexil"
)

func main() {
    // From environment variables
    client, err := vexil.New(vexil.WithEnvProvider())
    if err != nil {
        panic(err)
    }
    defer client.Close()

    darkMode := client.Bool("dark-mode", false)
    rateLimit := client.Int("api-rate-limit", 100)
    banner := client.String("banner-text", "Welcome")

    fmt.Printf("dark-mode=%v rate-limit=%d banner=%q\n",
        darkMode, rateLimit, banner)
}
```

## Providers

### Environment Variables

```go
client, _ := vexil.New(vexil.WithEnvProvider())
```

Reads flags from `FLAG_*` environment variables. The flag name is converted to uppercase with hyphens replaced by underscores: `dark-mode` becomes `FLAG_DARK_MODE`.

### Sidecar

```go
client, _ := vexil.New(vexil.WithSidecarProvider("http://localhost:8514"))
```

Fetches flags from the Vexil sidecar HTTP API.

### ConfigMap

```go
client, _ := vexil.New(vexil.WithConfigMapProvider("/etc/vexil"))
```

Reads flags from files in the mounted ConfigMap directory.

## API

### Client Methods

| Method | Signature | Description |
|:-------|:----------|:------------|
| `Bool` | `Bool(name string, defaultVal bool) bool` | Get boolean flag |
| `String` | `String(name string, defaultVal string) string` | Get string flag |
| `Int` | `Int(name string, defaultVal int) int` | Get integer flag |
| `JSON` | `JSON(name string, dst interface{}) error` | Unmarshal JSON flag |
| `Flag` | `Flag(name string) (Flag, error)` | Get raw flag struct |
| `AllFlags` | `AllFlags() ([]Flag, error)` | List all flags |
| `Close` | `Close() error` | Clean up resources |

### Flag Struct

```go
type Flag struct {
    Name     string
    Type     string   // "boolean", "string", "integer", "json"
    Value    string
    Disabled bool
}
```

### Provider Interface

Implement this to create custom providers:

```go
type Provider interface {
    GetFlag(name string) (Flag, error)
    GetAllFlags() ([]Flag, error)
    Close() error
}
```
