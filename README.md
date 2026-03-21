# Vexil

Kubernetes-native feature flags platform. Manage feature flags as CRDs and deliver them to workloads via environment variables, ConfigMaps, or a sidecar API.

## Architecture

Vexil is composed of three main components:

- **Operator** — Watches `FeatureFlag` CRDs and reconciles by injecting flag values into targeted workloads (Deployments, StatefulSets, DaemonSets).
- **API Server** — REST API that exposes flags, clusters, workloads, and audit events. Supports multi-cluster management via `ClusterConnection` CRDs.
- **Web Dashboard** — Next.js portal for managing flags, discovering workloads, and browsing audit logs.

An optional **sidecar** can be injected into pods to expose flags over a local HTTP endpoint with SSE streaming.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web Portal  │────▶│  API Server  │────▶│  Kubernetes  │
│  :3000       │     │  :8090       │     │  API         │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │                     ▲
                     ┌──────▼───────┐              │
                     │  PostgreSQL  │     ┌────────┴───────┐
                     │  (audit/state)│     │    Operator    │
                     └──────────────┘     │  (reconciler)  │
                                          └────────────────┘
```

## Prerequisites

| Component | Version |
|-----------|---------|
| Go | 1.24+ |
| Node.js | 20+ |
| Kubernetes | 1.26+ |
| Helm | 3.x |
| Docker | 20+ |

## Quick Start (Local Development)

### 1. Docker Desktop Kubernetes (recommended)

The full platform running on your local Kubernetes cluster:

```bash
# Ensure docker-desktop context is active
kubectl config use-context docker-desktop

# Build images locally (tagged for local use, no registry push needed)
make docker-build-local

# Deploy with Helm using dev values
make helm-install
```

This deploys all components to the `vexil-system` namespace:
- PostgreSQL (internal, ClusterIP)
- API Server (internal, ClusterIP on port 8090)
- Operator (watches CRDs and reconciles workloads)
- Web Dashboard on `localhost:30000` (NodePort)

Login with `admin` / `admin`.

After code changes, rebuild and redeploy:

```bash
make redeploy
```

To tear down:

```bash
make helm-uninstall
```

### 2. Docker Compose (no Kubernetes)

Run the dashboard and API without Kubernetes (operator features disabled):

```bash
docker compose up --build
```

This starts:
- PostgreSQL on `localhost:5432`
- API Server on `localhost:8090`
- Web Dashboard on `localhost:3001`

### 3. Run from source

Start each component separately:

```bash
# Terminal 1: API server
make run-apiserver

# Terminal 2: Operator (requires kubeconfig)
make run-operator

# Terminal 3: Web dashboard
make run-web
```

The API server listens on `:8090`, the operator exposes metrics on `:8080` and health on `:8081`, and the web dashboard runs on `:3000`.

## Deploy to Kubernetes

### Option A: Helm (recommended)

```bash
# Install with default configuration
helm install vexil deploy/helm/vexil \
  -n vexil-system --create-namespace

# With custom values
helm install vexil deploy/helm/vexil \
  -n vexil-system --create-namespace \
  -f my-values.yaml
```

Upgrade or uninstall:

```bash
make helm-upgrade
make helm-uninstall
```

### Authentication

Vexil uses a Kubernetes Secret to store the admin password. The behavior depends on the configuration:

**Production** (default `values.yaml`, `auth.adminPassword: ""`):
Helm generates a random 16-character password on first install and stores it in the `vexil-admin` secret. The password is preserved across `helm upgrade`. Retrieve it with:

```bash
kubectl get secret vexil-admin -n vexil-system -o jsonpath='{.data.admin-password}' | base64 -d
```

**Development** (`values-dev.yaml`, `auth.adminPassword: "admin"`):
The password is set to `admin` for convenience. Login with `admin` / `admin`.

**Custom password**:
Set a specific password during install:

```bash
helm install vexil deploy/helm/vexil \
  -n vexil-system --create-namespace \
  --set auth.adminPassword=my-secure-password
```

In all cases, the password is stored in the `vexil-admin` Kubernetes Secret and injected into the API server via the `VEXIL_ADMIN_PASSWORD` environment variable. The API server hashes it with bcrypt on startup and never stores the plaintext.

### Option B: Raw manifests

```bash
# Install CRDs
make install

# Deploy operator, RBAC, and API server
make deploy
```

### Build and push images

```bash
# Build operator and API server images
make docker-build

# Push to registry
make docker-push
```

Override image names:

```bash
make docker-build \
  IMG_OPERATOR=my-registry/vexil-operator:v0.1.0 \
  IMG_APISERVER=my-registry/vexil-apiserver:v0.1.0
```

## Custom Resources

### FeatureFlag

Defines a feature flag with type, targeting rules, delivery method, and rollout strategy:

```yaml
apiVersion: vexil.io/v1alpha1
kind: FeatureFlag
metadata:
  name: dark-mode
  namespace: default
spec:
  description: "Enable dark mode for the frontend"
  type: boolean          # boolean | string | integer | json
  defaultValue: "false"
  delivery:
    envVar:
      name: FEATURE_DARK_MODE
      selector:
        matchLabels:
          app: frontend
```

#### Targeting rules

Apply different values based on workload attributes:

```yaml
spec:
  rules:
    - name: premium-users
      conditions:
        - attribute: "label:tier"
          operator: eq          # eq | neq | in | notin | matches
          values: ["premium"]
      value: "1000"
```

#### Rollout strategies

Gradually roll out flag changes with canary steps:

```yaml
spec:
  rollout:
    strategy: canary       # immediate | canary | linear
    steps:
      - percentage: 10
        duration: "1h"
      - percentage: 50
        duration: "4h"
      - percentage: 100
        duration: "0s"
```

#### Delivery methods

| Method | Description |
|--------|-------------|
| `envVar` | Injects `FLAG_*` environment variables into matched pods |
| `configMap` | Writes flag values to a ConfigMap key |
| `sidecar` | Exposes flags via HTTP on port 8514 with SSE streaming |

### ClusterConnection

Registers a remote cluster for multi-cluster flag management:

```yaml
apiVersion: vexil.io/v1alpha1
kind: ClusterConnection
metadata:
  name: production
spec:
  displayName: "Production EU"
  apiServer: https://k8s.prod.example.com
  authMethod: serviceaccount    # kubeconfig | serviceaccount | oidc
  credentialRef:
    name: prod-cluster-secret
    namespace: vexil-system
```

## Helm Configuration

Key values in `values.yaml`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `operator.enabled` | `true` | Deploy the operator |
| `operator.replicas` | `1` | Operator replicas |
| `operator.leaderElect` | `true` | Enable leader election for HA |
| `apiserver.enabled` | `true` | Deploy the API server |
| `apiserver.port` | `8090` | API server listen port |
| `apiserver.corsOrigins` | `"*"` | Allowed CORS origins |
| `apiserver.databaseURL` | `""` | PostgreSQL URL (auto-configured if `postgresql.enabled`) |
| `web.enabled` | `true` | Deploy the web dashboard |
| `web.port` | `3000` | Dashboard listen port |
| `postgresql.enabled` | `true` | Deploy PostgreSQL subchart |
| `postgresql.auth.database` | `vexil` | Database name |
| `ingress.enabled` | `false` | Enable ingress |
| `metrics.enabled` | `false` | Enable Prometheus ServiceMonitor |
| `networkPolicy.enabled` | `false` | Enable network policies |
| `crds.install` | `true` | Install CRDs with the chart |
| `crds.keep` | `true` | Keep CRDs on uninstall |

## Environment Variables

| Variable | Component | Default | Description |
|----------|-----------|---------|-------------|
| `VEXIL_PORT` | API Server | `8090` | Listen port |
| `VEXIL_CORS_ORIGINS` | API Server | — | Comma-separated CORS origins |
| `VEXIL_DATABASE_URL` | API Server | — | PostgreSQL connection string |
| `VEXIL_CLUSTER_ID` | API Server | — | Local cluster identifier |
| `VEXIL_CLUSTER_NAME` | API Server | — | Local cluster display name |
| `VEXIL_API_URL` | Web | `http://localhost:8090` | Backend API URL (server-side proxy) |
| `NEXT_PUBLIC_API_URL` | Web | `/api/v1` | API URL (client-side, uses built-in proxy by default) |
| `VEXIL_NAMESPACE` | Sidecar | — | Namespace to watch |
| `VEXIL_SIDECAR_PORT` | Sidecar | `8514` | Sidecar HTTP port |

## Development

```bash
# Build binaries
make build

# Run tests
make test

# Lint and format
make fmt
make vet
make lint

# Apply sample FeatureFlags
make sample

# Clean build artifacts
make clean
```

## Project Structure

```
cmd/
  operator/        Operator entrypoint
  apiserver/       API server entrypoint
  vexil/           CLI tool (planned)
internal/
  operator/        Reconciler and controllers
  apiserver/       HTTP handlers and server
  discovery/       Workload scanner
  multicluster/    Multi-cluster connection manager
pkg/
  apis/v1alpha1/   CRD type definitions (FeatureFlag, ClusterConnection)
web/               Next.js dashboard
sidecar/           Feature flag sidecar
sdks/              Client SDKs (Go, Node, Python, .NET)
config/
  crd/             CRD manifests
  rbac/            RBAC roles and bindings
  samples/         Example FeatureFlag resources
  db/              PostgreSQL init scripts
deploy/
  helm/vexil/      Helm chart
examples/
  demo-app/        Example application consuming flags
```

## License

Apache-2.0
