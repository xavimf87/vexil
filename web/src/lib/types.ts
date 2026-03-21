// API types matching the Go backend

export type FlagType = 'boolean' | 'string' | 'integer' | 'json'
export type FlagPhase = 'Pending' | 'Active' | 'RollingOut' | 'Failed' | 'Disabled'
export type FlagLifecycle = 'active' | 'deprecated' | 'archived'

export interface FeatureFlag {
  name: string
  namespace: string
  clusterId: string
  description?: string
  type: FlagType
  defaultValue: string
  currentValue: string
  phase: FlagPhase
  disabled: boolean
  targetedWorkloads: number
  lifecycle: FlagLifecycle
  delivery?: DeliverySpec
  rules?: TargetingRule[]
  createdAt: string
  updatedAt?: string
}

export interface DeliverySpec {
  envVar?: {
    name?: string
    selector: LabelSelector
  }
  configMap?: {
    configMapName: string
    key: string
    selector: LabelSelector
  }
  sidecar?: {
    port?: number
    selector: LabelSelector
  }
}

export interface LabelSelector {
  matchLabels?: Record<string, string>
}

export interface TargetingRule {
  name: string
  conditions: Condition[]
  value: string
  percentage?: number
}

export interface Condition {
  attribute: string
  operator: 'eq' | 'neq' | 'in' | 'notin' | 'matches'
  values: string[]
}

export interface Cluster {
  id: string
  displayName: string
  apiServer: string
  status: 'Connected' | 'Disconnected' | 'Error'
  kubernetesVersion?: string
  discoveredWorkloads: number
}

export interface DiscoveredWorkload {
  cluster: string
  namespace: string
  name: string
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet'
  replicas: number
  labels: Record<string, string>
  containers: ContainerInfo[]
  matchingFlags?: string[]
}

export interface ContainerInfo {
  name: string
  image: string
  envVars: EnvVarInfo[]
  configMapRefs: { name: string; key?: string }[]
  secretRefs: { name: string; key?: string }[]
}

export interface EnvVarInfo {
  name: string
  value?: string
  source?: string
  isMasked: boolean
  isFlag: boolean
  flagName?: string
}

export interface AuditEvent {
  id: string
  timestamp: string
  actor?: string
  action: string
  resource: string
  resourceId: string
  cluster?: string
}
