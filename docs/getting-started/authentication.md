---
layout: default
title: Authentication
parent: Getting Started
nav_order: 2
---

# Authentication

Vexil uses token-based authentication with role-based access control (RBAC).

## Initial Login

On first install, Vexil creates an `admin` user. How the password is determined depends on the configuration:

### Production (default)

Helm generates a random 16-character password and stores it in a Kubernetes Secret. Retrieve it with:

```bash
kubectl get secret vexil-admin -n vexil-system \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

The password is preserved across `helm upgrade`.

### Development (values-dev.yaml)

The password is set to `admin`. Login with `admin` / `admin`.

### Custom Password

Set a specific password during install:

```bash
helm install vexil deploy/helm/vexil \
  -n vexil-system --create-namespace \
  --set auth.adminPassword=my-secure-password
```

In all cases, the password is stored in the `vexil-admin` Kubernetes Secret and injected into the API server via the `VEXIL_ADMIN_PASSWORD` environment variable. The API server hashes it with bcrypt on startup and never stores the plaintext.
{: .note }

## Roles

| Role | Flags | Clusters | Users | Audit |
|:-----|:------|:---------|:------|:------|
| **admin** | Create, read, update, delete, toggle | Register, remove | Create, update, delete | Read |
| **editor** | Create, read, update, toggle | Read | Update own password | Read |
| **viewer** | Read | Read | Update own password | Read |

## Managing Users

Admins can manage users from **Settings > Authentication** in the web dashboard:

- **Create user** --- Set username, password, and role
- **Edit user** --- Change password or role
- **Delete user** --- Remove a user (cannot delete yourself)

Non-admin users can change their own password from the same page.

## API Authentication

All API requests (except `POST /api/v1/auth/login` and `GET /healthz`) require a Bearer token:

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8090/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r .token)

# Use the token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8090/api/v1/flags

# Logout
curl -X POST http://localhost:8090/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

Tokens expire after 24 hours.

## Session Management

- Sessions are stored in-memory in the API server
- Tokens are 64-character hex strings generated with `crypto/rand`
- Restarting the API server invalidates all active sessions
