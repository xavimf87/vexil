---
layout: default
title: Sidecar
parent: Reference
nav_order: 4
---

# Sidecar Reference

The Vexil sidecar is an optional component that runs alongside your application pod, exposing feature flags via a local HTTP API with real-time SSE streaming.

## Endpoints

| Method | Path | Description |
|:-------|:-----|:------------|
| GET | `/flags` | All flags as JSON array |
| GET | `/flags/{name}` | Single flag as JSON |
| GET | `/flags/{name}/value` | Raw flag value as plain text |
| GET | `/flags/stream` | SSE stream of flag changes |
| GET | `/healthz` | Health check |

## Flag Response Format

```json
{
  "name": "dark-mode",
  "type": "boolean",
  "value": "true",
  "disabled": false,
  "description": "Enable dark mode"
}
```

## SSE Streaming

Connect to `/flags/stream` to receive real-time updates:

```bash
curl localhost:8514/flags/stream
```

Events are sent as:

```
event: update
data: {"name":"dark-mode","type":"boolean","value":"true","disabled":false}
```

A new event is sent whenever any flag in the namespace changes.

## Configuration

| Environment Variable | Default | Description |
|:---------------------|:--------|:------------|
| `VEXIL_NAMESPACE` | from serviceaccount or `default` | Namespace to watch for FeatureFlags |
| `VEXIL_SIDECAR_PORT` | `8514` | HTTP listen port |

The sidecar binds to `127.0.0.1` only (not externally accessible).

## Deployment

The sidecar is typically added as a container in your pod spec:

```yaml
spec:
  containers:
    - name: app
      image: my-app:latest
      env:
        - name: VEXIL_SIDECAR_ADDR
          value: "http://localhost:8514"
    - name: vexil-sidecar
      image: ghcr.io/vexil-platform/sidecar:latest
      env:
        - name: VEXIL_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
      ports:
        - containerPort: 8514
          name: sidecar
      livenessProbe:
        httpGet:
          path: /healthz
          port: sidecar
        initialDelaySeconds: 5
      resources:
        requests:
          cpu: 10m
          memory: 32Mi
        limits:
          cpu: 50m
          memory: 64Mi
```
