---
layout: default
title: Installation
parent: Getting Started
nav_order: 1
---

# Installation

## Helm (Recommended)

```bash
helm install vexil deploy/helm/vexil \
  -n vexil-system --create-namespace
```

This deploys all components: operator, API server, web dashboard, and PostgreSQL.

### Verify the installation

```bash
kubectl get pods -n vexil-system
```

You should see:

```
NAME                               READY   STATUS    RESTARTS   AGE
vexil-apiserver-xxx                1/1     Running   0          30s
vexil-operator-xxx                 1/1     Running   0          30s
vexil-postgresql-0                 1/1     Running   0          30s
vexil-web-xxx                      1/1     Running   0          30s
```

### Access the Dashboard

Forward the web service port:

```bash
kubectl port-forward svc/vexil-web 3000:3000 -n vexil-system
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Docker Compose (No Kubernetes)

For trying Vexil without a cluster:

```bash
git clone https://github.com/xavimf87/vexil.git
cd vexil
docker compose up --build
```

This starts:
- PostgreSQL on `localhost:5432`
- API Server on `localhost:8090`
- Web Dashboard on `localhost:3001`

## Local Development

For building from source:

```bash
# Terminal 1: API server
make run-apiserver

# Terminal 2: Operator (requires kubeconfig)
make run-operator

# Terminal 3: Web dashboard
make run-web
```

### Development with Kubernetes (Docker Desktop / kind / minikube)

A `values-dev.yaml` is provided for local development with images built locally:

```bash
# Build all images
make docker-build

# Install with dev values (pullPolicy: Never, tag: latest, password: admin)
make helm-install
```

This uses `imagePullPolicy: Never` so Kubernetes uses your local Docker images directly.

To rebuild and redeploy after code changes:

```bash
make redeploy
```

## Build and Push Images

For deploying to a cluster with a container registry:

```bash
# Build all images
make docker-build

# Push to registry
make docker-push
```

Override image names:

```bash
make docker-build \
  IMG_OPERATOR=my-registry/vexil-operator:v0.1.0 \
  IMG_APISERVER=my-registry/vexil-apiserver:v0.1.0 \
  IMG_WEB=my-registry/vexil-web:v0.1.0
```

## Raw Manifests (Without Helm)

```bash
# Install CRDs
make install

# Deploy operator, RBAC, and API server
make deploy

# Apply sample flags
make sample
```

## Uninstall

```bash
# Helm
make helm-uninstall

# CRDs are preserved by default. To remove them:
make uninstall
```
