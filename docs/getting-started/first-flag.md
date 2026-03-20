---
layout: default
title: Your First Flag
parent: Getting Started
nav_order: 3
---

# Your First Flag

This guide walks you through creating a feature flag and delivering it to a workload.

## 1. Create a FeatureFlag

```yaml
apiVersion: vexil.io/v1alpha1
kind: FeatureFlag
metadata:
  name: dark-mode
  namespace: default
spec:
  description: "Enable dark mode for the frontend"
  type: boolean
  defaultValue: "false"
  owner: "frontend-team"
  delivery:
    envVar:
      name: FEATURE_DARK_MODE
      selector:
        matchLabels:
          app: frontend
```

Apply it:

```bash
kubectl apply -f - <<EOF
apiVersion: vexil.io/v1alpha1
kind: FeatureFlag
metadata:
  name: dark-mode
  namespace: default
spec:
  description: "Enable dark mode for the frontend"
  type: boolean
  defaultValue: "false"
  owner: "frontend-team"
  delivery:
    envVar:
      name: FEATURE_DARK_MODE
      selector:
        matchLabels:
          app: frontend
EOF
```

## 2. Check the flag status

```bash
kubectl get featureflags
# or use the short name:
kubectl get ff
```

Output:

```
NAME        TYPE      DEFAULT   PHASE    TARGETED   AGE
dark-mode   boolean   false     Active   0          5s
```

## 3. Deploy a workload that receives the flag

The flag targets pods with label `app: frontend`. Create a simple deployment:

```bash
kubectl create deployment frontend --image=nginx
kubectl label deployment frontend app=frontend
```

The operator will inject `FEATURE_DARK_MODE=false` into the deployment's containers.

Verify:

```bash
kubectl get deployment frontend -o jsonpath='{.spec.template.spec.containers[0].env}' | jq
```

```json
[
  {
    "name": "FEATURE_DARK_MODE",
    "value": "false"
  }
]
```

## 4. Toggle the flag

Update the value:

```bash
kubectl patch featureflag dark-mode \
  -p '{"spec":{"defaultValue":"true"}}' --type=merge
```

Or toggle via the API:

```bash
curl -X POST http://localhost:8090/api/v1/flags/default/dark-mode/toggle \
  -H "Authorization: Bearer $TOKEN"
```

The operator will update the environment variable in the deployment, triggering a rolling update.

## 5. View in the dashboard

Open the Vexil web dashboard to see your flag, its status, targeted workloads, and delivery configuration.

## What's Next?

- [Delivery Methods](/vexil/guides/delivery-methods/) --- Learn about environment variables, ConfigMaps, and the sidecar
- [Targeting Rules](/vexil/guides/targeting-rules/) --- Deliver different values based on workload attributes
- [Rollout Strategies](/vexil/guides/rollouts/) --- Gradually roll out flag changes
- [Client SDKs](/vexil/sdks/) --- Read flags from your application code
