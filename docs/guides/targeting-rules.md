---
layout: default
title: Targeting Rules
parent: Guides
nav_order: 2
---

# Targeting Rules

Targeting rules let you deliver different flag values to different workloads based on their attributes.

## How Rules Work

Rules are evaluated in order. The first rule whose conditions all match wins. If no rules match, the `defaultValue` is used.

```yaml
spec:
  type: integer
  defaultValue: "100"
  rules:
    - name: premium-users
      conditions:
        - attribute: "label:tier"
          operator: eq
          values: ["premium"]
      value: "1000"

    - name: staging-unlimited
      conditions:
        - attribute: namespace
          operator: eq
          values: ["staging"]
      value: "999999"
```

In this example:
- Workloads with label `tier=premium` get value `1000`
- Workloads in the `staging` namespace get value `999999`
- All other workloads get the default value `100`

## Condition Attributes

| Attribute | Description | Example |
|:----------|:------------|:--------|
| `namespace` | Workload's namespace | `default`, `production` |
| `label:<key>` | Workload's label value | `label:tier`, `label:app` |
| `annotation:<key>` | Workload's annotation value | `annotation:team` |
| `workload-name` | Name of the Deployment/StatefulSet/DaemonSet | `frontend`, `api-gateway` |

## Operators

| Operator | Description | Example |
|:---------|:------------|:--------|
| `eq` | Equals one of the values | `operator: eq, values: ["production"]` |
| `neq` | Not equal to any of the values | `operator: neq, values: ["staging"]` |
| `in` | Value is in the list | `operator: in, values: ["us-east", "us-west"]` |
| `notin` | Value is not in the list | `operator: notin, values: ["deprecated"]` |
| `matches` | Value matches a regex pattern | `operator: matches, values: ["^prod-.*"]` |

## Multiple Conditions (AND Logic)

All conditions in a rule must be true for the rule to match:

```yaml
rules:
  - name: premium-in-production
    conditions:
      - attribute: "label:tier"
        operator: eq
        values: ["premium"]
      - attribute: namespace
        operator: eq
        values: ["production"]
    value: "2000"
```

This rule only matches workloads that have BOTH `tier=premium` label AND are in the `production` namespace.

## Percentage-Based Targeting

Apply a flag value to only a percentage of matching workloads:

```yaml
rules:
  - name: beta-users
    conditions:
      - attribute: "label:app"
        operator: eq
        values: ["frontend"]
    value: "true"
    percentage: 25   # Only 25% of matching workloads
```

## Examples

### Feature flag per environment

```yaml
spec:
  type: string
  defaultValue: "basic"
  rules:
    - name: staging-features
      conditions:
        - attribute: namespace
          operator: in
          values: ["staging", "dev"]
      value: "all"
    - name: canary-features
      conditions:
        - attribute: "label:track"
          operator: eq
          values: ["canary"]
      value: "experimental"
```

### Team-specific configuration

```yaml
spec:
  type: integer
  defaultValue: "50"
  rules:
    - name: platform-team
      conditions:
        - attribute: "annotation:team"
          operator: eq
          values: ["platform"]
      value: "500"
    - name: specific-service
      conditions:
        - attribute: workload-name
          operator: eq
          values: ["high-throughput-api"]
      value: "1000"
```
