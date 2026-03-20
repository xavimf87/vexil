import type { FeatureFlag, Cluster, DiscoveredWorkload, AuditEvent } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vexil-token') : null
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  })

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('vexil-token')
    localStorage.removeItem('vexil-user')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Login failed' }))
        throw new Error(err.error || 'Login failed')
      }
      return res.json() as Promise<{ token: string; user: { username: string; role: string } }>
    }),

  logout: (token: string) =>
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {}),
}

// Flags
export const flagsApi = {
  list: (params?: { clusterId?: string; namespace?: string }) => {
    const search = new URLSearchParams()
    if (params?.clusterId) search.set('clusterId', params.clusterId)
    if (params?.namespace) search.set('namespace', params.namespace)
    const qs = search.toString()
    return request<FeatureFlag[]>(`/flags${qs ? `?${qs}` : ''}`)
  },

  get: (namespace: string, name: string, clusterId: string) =>
    request<FeatureFlag>(`/flags/${namespace}/${name}?clusterId=${clusterId}`),

  create: (data: {
    name: string
    namespace: string
    clusterId: string
    type: string
    defaultValue: string
    description?: string
    owner?: string
    delivery?: FeatureFlag['delivery']
  }) => request<FeatureFlag>('/flags', { method: 'POST', body: JSON.stringify(data) }),

  update: (namespace: string, name: string, clusterId: string, data: Partial<FeatureFlag>) =>
    request<FeatureFlag>(`/flags/${namespace}/${name}?clusterId=${clusterId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (namespace: string, name: string, clusterId: string) =>
    request<void>(`/flags/${namespace}/${name}?clusterId=${clusterId}`, { method: 'DELETE' }),

  toggle: (namespace: string, name: string, clusterId: string) =>
    request<FeatureFlag>(`/flags/${namespace}/${name}/toggle?clusterId=${clusterId}`, {
      method: 'POST',
    }),
}

// Clusters
export const clustersApi = {
  list: () => request<Cluster[]>('/clusters'),

  get: (id: string) => request<Cluster>(`/clusters/${id}`),

  register: (data: {
    id: string
    displayName: string
    apiServer: string
    kubeconfig?: string
    token?: string
  }) => request<Cluster>('/clusters', { method: 'POST', body: JSON.stringify(data) }),

  remove: (id: string) => request<void>(`/clusters/${id}`, { method: 'DELETE' }),
}

// Workloads
export const workloadsApi = {
  list: (clusterId: string, namespace?: string) => {
    const qs = namespace ? `?namespace=${namespace}` : ''
    return request<DiscoveredWorkload[]>(`/clusters/${clusterId}/workloads${qs}`)
  },

  get: (clusterId: string, namespace: string, name: string) =>
    request<DiscoveredWorkload>(`/clusters/${clusterId}/workloads/${namespace}/${name}`),
}

// Users
export const usersApi = {
  list: () => request<{ username: string; role: string; createdAt: string }[]>('/users'),
  create: (data: { username: string; password: string; role: string }) =>
    request<{ username: string; role: string }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (username: string, data: { password?: string; role?: string }) =>
    request<void>(`/users/${username}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (username: string) =>
    request<void>(`/users/${username}`, { method: 'DELETE' }),
}

// Audit
export const auditApi = {
  list: (params?: { resource?: string; action?: string; cluster?: string }) => {
    const search = new URLSearchParams()
    if (params?.resource) search.set('resource', params.resource)
    if (params?.action) search.set('action', params.action)
    if (params?.cluster) search.set('cluster', params.cluster)
    const qs = search.toString()
    return request<AuditEvent[]>(`/audit${qs ? `?${qs}` : ''}`)
  },
}
