---
layout: default
title: Helm Values
parent: Reference
nav_order: 3
---

# Helm Values Reference

Full reference for `values.yaml` configuration.

## Authentication

| Parameter | Default | Description |
|:----------|:--------|:------------|
| `auth.enabled` | `true` | Enable authentication |
| `auth.adminUser` | `"admin"` | Admin username |
| `auth.adminPassword` | `""` | Admin password. Empty = random 16-char generated |

## Operator

| Parameter | Default | Description |
|:----------|:--------|:------------|
| `operator.enabled` | `true` | Deploy the operator |
| `operator.image.repository` | `ghcr.io/vexil-platform/operator` | Image repository |
| `operator.image.tag` | `""` (appVersion) | Image tag |
| `operator.image.pullPolicy` | `IfNotPresent` | Pull policy |
| `operator.replicas` | `1` | Replica count |
| `operator.leaderElect` | `true` | Enable leader election for HA |
| `operator.resources.requests.cpu` | `100m` | CPU request |
| `operator.resources.requests.memory` | `64Mi` | Memory request |
| `operator.resources.limits.cpu` | `200m` | CPU limit |
| `operator.resources.limits.memory` | `128Mi` | Memory limit |
| `operator.nodeSelector` | `{}` | Node selector |
| `operator.tolerations` | `[]` | Tolerations |
| `operator.affinity` | `{}` | Affinity rules |
| `operator.extraEnv` | `[]` | Additional env vars |
| `operator.podAnnotations` | `{}` | Pod annotations |

## API Server

| Parameter | Default | Description |
|:----------|:--------|:------------|
| `apiserver.enabled` | `true` | Deploy the API server |
| `apiserver.image.repository` | `ghcr.io/vexil-platform/apiserver` | Image repository |
| `apiserver.image.tag` | `""` (appVersion) | Image tag |
| `apiserver.image.pullPolicy` | `IfNotPresent` | Pull policy |
| `apiserver.replicas` | `1` | Replica count |
| `apiserver.port` | `8090` | Listen port |
| `apiserver.corsOrigins` | `"*"` | Allowed CORS origins |
| `apiserver.databaseURL` | `""` | PostgreSQL URL (auto-configured if postgresql.enabled) |
| `apiserver.resources.requests.cpu` | `100m` | CPU request |
| `apiserver.resources.requests.memory` | `128Mi` | Memory request |
| `apiserver.resources.limits.cpu` | `500m` | CPU limit |
| `apiserver.resources.limits.memory` | `256Mi` | Memory limit |
| `apiserver.service.type` | `ClusterIP` | Service type |
| `apiserver.service.port` | `8090` | Service port |

## Web Portal

| Parameter | Default | Description |
|:----------|:--------|:------------|
| `web.enabled` | `true` | Deploy the web dashboard |
| `web.image.repository` | `ghcr.io/vexil-platform/web` | Image repository |
| `web.image.tag` | `""` (appVersion) | Image tag |
| `web.image.pullPolicy` | `IfNotPresent` | Pull policy |
| `web.replicas` | `1` | Replica count |
| `web.port` | `3000` | Listen port |
| `web.resources.requests.cpu` | `50m` | CPU request |
| `web.resources.requests.memory` | `128Mi` | Memory request |
| `web.resources.limits.cpu` | `200m` | CPU limit |
| `web.resources.limits.memory` | `256Mi` | Memory limit |
| `web.service.type` | `ClusterIP` | Service type |
| `web.service.port` | `3000` | Service port |

## Ingress

| Parameter | Default | Description |
|:----------|:--------|:------------|
| `ingress.enabled` | `false` | Enable ingress |
| `ingress.className` | `""` | Ingress class name |
| `ingress.annotations` | `{}` | Ingress annotations |
| `ingress.hosts` | See values.yaml | Host and path configuration |
| `ingress.tls` | `[]` | TLS configuration |

## PostgreSQL

| Parameter | Default | Description |
|:----------|:--------|:------------|
| `postgresql.enabled` | `true` | Deploy PostgreSQL subchart |
| `postgresql.auth.database` | `vexil` | Database name |
| `postgresql.auth.username` | `vexil` | Database user |
| `postgresql.auth.password` | `""` | Database password |
| `postgresql.auth.existingSecret` | `""` | Use existing secret |
| `postgresql.primary.persistence.enabled` | `true` | Enable persistence |
| `postgresql.primary.persistence.size` | `5Gi` | Storage size |

## Other

| Parameter | Default | Description |
|:----------|:--------|:------------|
| `serviceAccount.create` | `true` | Create ServiceAccount |
| `serviceAccount.name` | `""` | ServiceAccount name |
| `rbac.create` | `true` | Create RBAC resources |
| `crds.install` | `true` | Install CRDs with chart |
| `crds.keep` | `true` | Keep CRDs on uninstall |
| `metrics.enabled` | `false` | Enable Prometheus ServiceMonitor |
| `metrics.interval` | `30s` | Scrape interval |
| `networkPolicy.enabled` | `false` | Enable network policies |
| `podDisruptionBudget.operator.enabled` | `false` | Enable PDB for operator |
| `podDisruptionBudget.apiserver.enabled` | `false` | Enable PDB for API server |

## Environment Variables

| Variable | Component | Default | Description |
|:---------|:----------|:--------|:------------|
| `VEXIL_PORT` | API Server | `8090` | Listen port |
| `VEXIL_CORS_ORIGINS` | API Server | --- | Comma-separated CORS origins |
| `VEXIL_DATABASE_URL` | API Server | --- | PostgreSQL connection string |
| `VEXIL_CLUSTER_ID` | API Server | `local` | Local cluster identifier |
| `VEXIL_CLUSTER_NAME` | API Server | `Local Cluster` | Local cluster display name |
| `VEXIL_ADMIN_PASSWORD` | API Server | --- | Admin password (from secret) |
| `VEXIL_API_URL` | Web | `http://localhost:8090` | Backend URL (server-side) |
| `NEXT_PUBLIC_API_URL` | Web | `/api/v1` | API URL (client-side proxy) |
| `VEXIL_NAMESPACE` | Sidecar | --- | Namespace to watch |
| `VEXIL_SIDECAR_PORT` | Sidecar | `8514` | Sidecar listen port |
