---
layout: default
title: Delivery Methods
parent: Guides
nav_order: 1
---

# Delivery Methods

Vexil supports three ways to deliver flag values to your workloads. Choose based on your application's needs.

## Environment Variables

The simplest method. The operator injects environment variables directly into matching pods.

```yaml
spec:
  type: boolean
  defaultValue: "true"
  delivery:
    envVar:
      name: FEATURE_DARK_MODE    # optional, defaults to FLAG_<UPPERCASE_NAME>
      selector:
        matchLabels:
          app: frontend
```

**How it works:**
1. The operator finds Deployments, StatefulSets, and DaemonSets matching the label selector
2. Injects the env var into all containers
3. Adds a `vexil.io/flags-hash` annotation to track changes
4. When the flag value changes, the annotation hash changes, triggering a rolling update

**When to use:**
- Simple boolean or string flags
- Applications that read configuration from environment
- When you want automatic restarts on flag changes

## ConfigMaps

The operator writes flag values to a ConfigMap key. Your application reads the mounted file.

```yaml
spec:
  type: integer
  defaultValue: "100"
  delivery:
    configMap:
      configMapName: vexil-flags
      key: api-rate-limit
      selector:
        matchLabels:
          app: api-gateway
```

**How it works:**
1. The operator creates or updates the ConfigMap with the flag value
2. Your workload mounts the ConfigMap as a volume
3. Kubernetes propagates the change to the mounted file (eventual consistency, ~1 minute)
4. Your application reads the file to get the current value

**Example workload mounting:**

```yaml
spec:
  containers:
    - name: api
      volumeMounts:
        - name: flags
          mountPath: /etc/vexil
          readOnly: true
  volumes:
    - name: flags
      configMap:
        name: vexil-flags
```

**When to use:**
- Flags that change frequently (no pod restarts needed)
- Integer or JSON configuration values
- Applications that watch files for changes

## Sidecar

An in-pod HTTP server that exposes flags via a local API with real-time SSE streaming.

```yaml
spec:
  type: boolean
  defaultValue: "false"
  delivery:
    sidecar:
      port: 8514            # optional, default 8514
      selector:
        matchLabels:
          app: checkout
```

**Sidecar endpoints:**

| Endpoint | Description |
|:---------|:------------|
| `GET /flags` | All flags as JSON array |
| `GET /flags/{name}` | Single flag as JSON |
| `GET /flags/{name}/value` | Raw value as text |
| `GET /flags/stream` | SSE stream of flag changes |
| `GET /healthz` | Health check |

**Example from your application:**

```bash
# Get a flag value
curl localhost:8514/flags/dark-mode/value
# -> true

# Stream changes in real-time
curl localhost:8514/flags/stream
# -> event: update
# -> data: {"name":"dark-mode","type":"boolean","value":"true","disabled":false}
```

**When to use:**
- Real-time flag updates without restarts
- Applications using the Vexil client SDKs
- Complex flag evaluation logic on the client side

## Comparison

| Feature | Env Var | ConfigMap | Sidecar |
|:--------|:--------|:----------|:--------|
| Restart on change | Yes | No | No |
| Update latency | Seconds (rolling update) | ~1 minute | Instant (SSE) |
| Complexity | Low | Medium | Medium |
| SDK required | No | No | Optional |
| Multiple flags per delivery | One per FeatureFlag | One per FeatureFlag | All flags |
