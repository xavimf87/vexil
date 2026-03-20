---
layout: default
title: Multi-Cluster
parent: Guides
nav_order: 4
---

# Multi-Cluster Management

Vexil supports managing feature flags across multiple Kubernetes clusters from a single dashboard.

## How It Works

The API server maintains connections to multiple clusters via the `ClusterConnection` CRD. Each cluster is discovered and its workloads are scanned for flag delivery.

The local cluster (where the operator runs) is auto-registered on startup.

## Registering a Cluster

### Via CRD

```yaml
apiVersion: vexil.io/v1alpha1
kind: ClusterConnection
metadata:
  name: production-eu
  namespace: vexil-system
spec:
  displayName: "Production EU"
  apiServer: https://k8s.prod-eu.example.com
  authMethod: serviceaccount
  credentialRef:
    name: prod-eu-credentials
    key: token
  namespaces:
    - default
    - production
  resyncPeriod: "30s"
  labels:
    region: eu-west-1
    environment: production
```

### Via API

```bash
curl -X POST http://localhost:8090/api/v1/clusters \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "production-eu",
    "displayName": "Production EU",
    "apiServer": "https://k8s.prod-eu.example.com"
  }'
```

### Via Dashboard

Navigate to **Clusters** and click **Register Cluster** (admin only).

## Authentication Methods

| Method | Description |
|:-------|:------------|
| `kubeconfig` | Use a kubeconfig file stored in a Secret |
| `serviceaccount` | Use a ServiceAccount token |
| `oidc` | Use OIDC authentication |

The credentials are stored in a Kubernetes Secret referenced by `credentialRef`.

## Cluster Status

| Phase | Description |
|:------|:------------|
| `Connected` | Cluster is reachable and workloads are being discovered |
| `Disconnected` | Cluster is unreachable |
| `Error` | Connection or authentication error |

## Workload Discovery

When a cluster is connected, Vexil automatically discovers workloads (Deployments, StatefulSets, DaemonSets) and their configuration:

- Container images and environment variables
- ConfigMap and Secret references
- Existing feature flag injections

View discovered workloads in the **Workloads** tab of the dashboard.
