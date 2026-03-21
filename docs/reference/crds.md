---
layout: default
title: CRD Reference
parent: Reference
nav_order: 2
---

# CRD Reference

Vexil defines two Custom Resource Definitions.

## FeatureFlag

**API Version:** `vexil.io/v1alpha1`
**Kind:** `FeatureFlag`
**Short name:** `ff`

### Spec

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `type` | string | Yes | Flag data type: `boolean`, `string`, `integer`, `json` |
| `defaultValue` | string | Yes | Default value when no targeting rules match |
| `description` | string | No | Human-readable description |
| `disabled` | bool | No | Kill switch that disables the flag globally |
| `lifecycle` | string | No | `active` (default), `deprecated`, `archived` |
| `rules` | []TargetingRule | No | Targeting rules evaluated in order |
| `delivery` | DeliverySpec | No | How the flag is delivered to workloads |
| `rollout` | RolloutSpec | No | Progressive rollout configuration |

### TargetingRule

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | string | Yes | Human-readable label |
| `conditions` | []Condition | Yes | All must be true (AND logic) |
| `value` | string | Yes | Value when rule matches |
| `percentage` | int32 | No | Percentage of matching targets (0-100) |

### Condition

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `attribute` | string | Yes | `namespace`, `label:<key>`, `annotation:<key>`, `workload-name` |
| `operator` | string | Yes | `eq`, `neq`, `in`, `notin`, `matches` |
| `values` | []string | Yes | Values to compare against |

### DeliverySpec

Only one delivery method should be specified.

**envVar:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | string | No | Env var name. Defaults to `FLAG_<UPPERCASE_NAME>` |
| `selector` | LabelSelector | Yes | Targets workloads by labels |

**configMap:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `configMapName` | string | Yes | ConfigMap name |
| `key` | string | Yes | Key within ConfigMap |
| `selector` | LabelSelector | Yes | Targets workloads by labels |

**sidecar:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `port` | int32 | No | Listen port (default: 8514) |
| `selector` | LabelSelector | Yes | Targets workloads by labels |

### RolloutSpec

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `strategy` | string | Yes | `immediate`, `canary`, `linear` |
| `steps` | []RolloutStep | No | Rollout progression |

### RolloutStep

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `percentage` | int32 | Yes | Traffic percentage (0-100) |
| `duration` | Duration | Yes | Wait time before next step |

### Status

| Field | Type | Description |
|:------|:-----|:------------|
| `phase` | string | `Pending`, `Active`, `RollingOut`, `Failed`, `Disabled` |
| `currentValue` | string | Effective value after rollout computation |
| `rolloutProgress` | int32 | Rollout progress (0-100) |
| `targetedWorkloads` | int32 | Number of workloads receiving the flag |
| `lastUpdated` | Time | Last status update |
| `conditions` | []Condition | Standard Kubernetes conditions |
| `observedGeneration` | int64 | Last observed generation |

---

## ClusterConnection

**API Version:** `vexil.io/v1alpha1`
**Kind:** `ClusterConnection`

### Spec

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `displayName` | string | Yes | Human-friendly cluster name |
| `authMethod` | string | Yes | `kubeconfig`, `serviceaccount`, `oidc` |
| `apiServer` | string | Yes | Kubernetes API server URL |
| `credentialRef` | SecretKeyRef | Yes | Reference to Secret with credentials |
| `namespaces` | []string | No | Namespaces to watch (empty = all) |
| `resyncPeriod` | Duration | No | How often to resync (default: 30s) |
| `labels` | map[string]string | No | Labels for cluster targeting |

### SecretKeyRef

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | string | Yes | Secret name |
| `key` | string | Yes | Key within Secret |

### Status

| Field | Type | Description |
|:------|:-----|:------------|
| `phase` | string | `Connected`, `Disconnected`, `Error` |
| `kubernetesVersion` | string | Cluster K8s version |
| `lastProbe` | Time | Last connectivity verification |
| `discoveredWorkloads` | int32 | Number of workloads found |
| `conditions` | []Condition | Standard Kubernetes conditions |
