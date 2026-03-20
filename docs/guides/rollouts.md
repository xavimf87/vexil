---
layout: default
title: Rollout Strategies
parent: Guides
nav_order: 3
---

# Rollout Strategies

Vexil supports progressive rollouts to safely deploy flag changes.

## Strategies

### Immediate (default)

The flag value changes instantly for all targeted workloads:

```yaml
spec:
  rollout:
    strategy: immediate
```

### Canary

Gradually increase the percentage of workloads receiving the new value:

```yaml
spec:
  defaultValue: "true"
  rollout:
    strategy: canary
    steps:
      - percentage: 10
        duration: "1h"
      - percentage: 25
        duration: "2h"
      - percentage: 50
        duration: "4h"
      - percentage: 100
        duration: "0s"
```

This rolls out the flag to:
1. 10% of targeted workloads for 1 hour
2. 25% for 2 hours
3. 50% for 4 hours
4. 100% (complete)

### Linear

Automatically increase the percentage at regular intervals:

```yaml
spec:
  rollout:
    strategy: linear
    steps:
      - percentage: 100
        duration: "1h"    # reaches 100% over 1 hour
```

## Monitoring Rollouts

Check rollout progress:

```bash
kubectl get featureflag new-checkout -o wide
```

The `PHASE` column shows `RollingOut` during a rollout, and the status includes `rolloutProgress` (0-100).

## Aborting a Rollout

To abort a rollout, disable the flag:

```bash
kubectl patch featureflag new-checkout \
  -p '{"spec":{"disabled":true}}' --type=merge
```

The flag phase changes to `Disabled` and the previous value is restored.
