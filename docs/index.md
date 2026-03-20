---
layout: home
title: Home
nav_order: 1
---

# Vexil

**Kubernetes-native Feature Flags Platform**
{: .fs-6 .fw-300 }

Manage feature flags as Kubernetes CRDs and deliver them to your workloads via environment variables, ConfigMaps, or a sidecar API with real-time streaming.

[Get Started](/vexil/getting-started/){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/xavimf87/vexil){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Key Features

- **Kubernetes-Native** --- Feature flags as CRDs, fully integrated with the Kubernetes ecosystem
- **Multiple Delivery Methods** --- Environment variables, ConfigMaps, or sidecar with SSE streaming
- **Targeting Rules** --- Conditional flag values based on namespace, labels, annotations, or workload name
- **Progressive Rollouts** --- Canary, linear, or immediate rollout strategies
- **Multi-Cluster** --- Manage flags across multiple Kubernetes clusters from a single dashboard
- **Role-Based Access** --- Admin, editor, and viewer roles with token-based authentication
- **Client SDKs** --- Go, Python, Node.js, and .NET SDKs with a unified API
- **Audit Logging** --- Every change tracked with full history
- **Web Dashboard** --- Modern UI for managing flags, discovering workloads, and browsing audit logs

## Architecture

```
                        ┌──────────────┐
                        │  Web Portal  │
                        │    :3000     │
                        └──────┬───────┘
                               │
┌──────────────┐       ┌──────▼───────┐       ┌──────────────┐
│  PostgreSQL  │◄──────│  API Server  │──────►│  Kubernetes  │
│  (audit/state)│       │    :8090     │       │  API Server  │
└──────────────┘       └──────────────┘       └──────┬───────┘
                                                      │
                                              ┌───────▼────────┐
                                              │    Operator     │
                                              │  (reconciler)   │
                                              └────────────────┘
```

| Component | Description |
|:----------|:------------|
| **Operator** | Watches `FeatureFlag` CRDs and injects flag values into targeted workloads |
| **API Server** | REST API for managing flags, clusters, workloads, and audit events |
| **Web Dashboard** | Next.js portal for flag management and workload discovery |
| **Sidecar** | Optional in-pod HTTP server exposing flags with SSE streaming |

## Quick Links

- [Installation](/vexil/getting-started/installation/)
- [Your First Flag](/vexil/getting-started/first-flag/)
- [Delivery Methods](/vexil/guides/delivery-methods/)
- [API Reference](/vexil/reference/api/)
- [Client SDKs](/vexil/sdks/)
- [Helm Configuration](/vexil/reference/helm-values/)
