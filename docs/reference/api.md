---
layout: default
title: API Reference
parent: Reference
nav_order: 1
---

# API Reference

The Vexil API server exposes a REST API on port `8090` (default).

All endpoints (except login and healthz) require a Bearer token in the `Authorization` header.

## Authentication

### POST /api/v1/auth/login

Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "my-password"
}
```

**Response (200):**
```json
{
  "token": "726dbcff...",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

### POST /api/v1/auth/logout

Invalidate the current session token.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{ "message": "logged out" }
```

### GET /api/v1/auth/me

Get current user info.

**Response (200):**
```json
{
  "username": "admin",
  "role": "admin"
}
```

---

## Users

### GET /api/v1/users

List all users. Available to all authenticated roles.

**Response (200):**
```json
[
  {
    "username": "admin",
    "role": "admin",
    "createdAt": "2026-03-20T10:00:00Z"
  }
]
```

### POST /api/v1/users

Create a new user. **Admin only.**

**Request:**
```json
{
  "username": "alice",
  "password": "secure-password",
  "role": "editor"
}
```

Valid roles: `admin`, `editor`, `viewer`.

**Response (201):**
```json
{
  "username": "alice",
  "role": "editor"
}
```

### PUT /api/v1/users/{username}

Update a user's password or role. Admins can update any user. Non-admins can only update their own password.

**Request:**
```json
{
  "password": "new-password",
  "role": "admin"
}
```

Both fields are optional. Only include what you want to change.

**Response (200):**
```json
{ "message": "user updated" }
```

### DELETE /api/v1/users/{username}

Delete a user. **Admin only.** Cannot delete yourself.

**Response (200):**
```json
{ "message": "user deleted" }
```

---

## Flags

### GET /api/v1/flags

List all feature flags.

**Query parameters:**
- `clusterId` (optional) --- Filter by cluster
- `namespace` (optional) --- Filter by namespace

**Response (200):** Array of FeatureFlag objects.

### POST /api/v1/flags

Create a new feature flag. **Admin or editor.**

**Request:**
```json
{
  "name": "dark-mode",
  "namespace": "default",
  "clusterId": "local",
  "type": "boolean",
  "defaultValue": "false",
  "description": "Enable dark mode",
  "owner": "frontend-team",
  "delivery": {
    "envVar": {
      "name": "FEATURE_DARK_MODE",
      "selector": {
        "matchLabels": { "app": "frontend" }
      }
    }
  }
}
```

### GET /api/v1/flags/{namespace}/{name}

Get a specific flag.

**Query parameters:**
- `clusterId` (required)

### PUT /api/v1/flags/{namespace}/{name}

Update a flag. **Admin or editor.**

### DELETE /api/v1/flags/{namespace}/{name}

Delete a flag. **Admin only.**

### POST /api/v1/flags/{namespace}/{name}/toggle

Toggle a flag's enabled/disabled state. **Admin or editor.**

---

## Clusters

### GET /api/v1/clusters

List connected clusters.

**Response (200):**
```json
[
  {
    "id": "local",
    "displayName": "Local Cluster",
    "apiServer": "https://kubernetes.default.svc",
    "status": "Connected",
    "kubernetesVersion": "v1.30.0",
    "discoveredWorkloads": 12
  }
]
```

### POST /api/v1/clusters

Register a remote cluster. **Admin only.**

**Request:**
```json
{
  "id": "production",
  "displayName": "Production EU",
  "apiServer": "https://k8s.prod.example.com"
}
```

### GET /api/v1/clusters/{id}

Get cluster details.

### DELETE /api/v1/clusters/{id}

Disconnect a cluster. **Admin only.**

---

## Workloads

### GET /api/v1/clusters/{id}/namespaces

List user namespaces in a cluster (excludes system namespaces).

**Response (200):**
```json
["default", "production", "staging"]
```

### GET /api/v1/clusters/{id}/workloads

List discovered workloads in a cluster.

**Query parameters:**
- `namespace` (optional) --- Filter by namespace

**Response (200):** Array of DiscoveredWorkload objects with container info, env vars, ConfigMap/Secret references.

### GET /api/v1/clusters/{id}/workloads/{namespace}/{name}

Get details for a specific workload.

---

## Audit

### GET /api/v1/audit

List audit events.

**Query parameters:**
- `resource` (optional) --- Filter by resource type
- `action` (optional) --- Filter by action
- `cluster` (optional) --- Filter by cluster

---

## Health

### GET /healthz

Health check endpoint. No authentication required.

**Response (200):** `ok`

---

## Error Responses

All errors follow this format:

```json
{
  "error": "descriptive error message"
}
```

| Status | Meaning |
|:-------|:--------|
| 400 | Bad request (invalid input) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate username) |
| 500 | Internal server error |
| 502 | Backend unreachable (web proxy) |
