'use client'

import { useQuery } from '@tanstack/react-query'
import { clustersApi, workloadsApi } from '@/lib/api-client'
import { useState, useEffect } from 'react'
import { Boxes, ChevronRight, Search, AlertCircle, Flag } from 'lucide-react'
import type { DiscoveredWorkload } from '@/lib/types'

async function fetchNamespaces(clusterId: string): Promise<string[]> {
  const res = await fetch(`/api/v1/clusters/${clusterId}/namespaces`)
  if (!res.ok) return []
  return res.json()
}

export default function WorkloadsPage() {
  const [selectedCluster, setSelectedCluster] = useState('')
  const [selectedNamespace, setSelectedNamespace] = useState('')
  const [expandedWorkload, setExpandedWorkload] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: clusters = [] } = useQuery({ queryKey: ['clusters'], queryFn: () => clustersApi.list() })

  // Auto-select when there's only one cluster
  useEffect(() => {
    if (clusters.length === 1 && !selectedCluster) {
      setSelectedCluster(clusters[0].id)
    }
  }, [clusters, selectedCluster])

  const { data: namespaces = [] } = useQuery({
    queryKey: ['namespaces', selectedCluster],
    queryFn: () => fetchNamespaces(selectedCluster),
    enabled: !!selectedCluster,
  })

  const { data: workloads = [], isLoading, isError, error } = useQuery({
    queryKey: ['workloads', selectedCluster, selectedNamespace],
    queryFn: () => workloadsApi.list(selectedCluster, selectedNamespace || undefined),
    enabled: !!selectedCluster,
    retry: 1,
    staleTime: 30000,
  })

  const filtered = workloads.filter((w) =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.namespace.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Workloads</h1>
        <p className="text-sm text-slate-400 mt-1">Workloads in namespaces with feature flags</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={selectedCluster}
          onChange={(e) => { setSelectedCluster(e.target.value); setSelectedNamespace(''); setExpandedWorkload(null) }}
          className="rounded-lg border border-white/[0.06] bg-slate-900 px-3 py-2.5 text-sm min-w-[200px]">
          <option value="">Select a cluster...</option>
          {clusters?.map((c) => (
            <option key={c.id} value={c.id}>{c.displayName} ({c.id})</option>
          ))}
        </select>
        {selectedCluster && namespaces && namespaces.length > 0 && (
          <select value={selectedNamespace}
            onChange={(e) => { setSelectedNamespace(e.target.value); setExpandedWorkload(null) }}
            className="rounded-lg border border-white/[0.06] bg-slate-900 px-3 py-2.5 text-sm min-w-[160px]">
            <option value="">All namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        )}
        {selectedCluster && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter workloads..."
              className="w-full rounded-lg border border-white/[0.06] bg-slate-900 pl-10 pr-4 py-2.5 text-sm" />
          </div>
        )}
      </div>

      {!selectedCluster ? (
        <div className="glass rounded-xl p-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <Boxes className="h-8 w-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Select a cluster</h3>
          <p className="mt-2 text-sm text-slate-400">Choose a cluster above to discover its workloads.</p>
        </div>
      ) : isLoading ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">Scanning cluster...</p>
        </div>
      ) : isError ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Failed to scan cluster</h3>
          <p className="mt-1 text-xs text-slate-500">{error instanceof Error ? error.message : 'Connection error'}</p>
          <p className="mt-2 text-xs text-slate-500">Try selecting a specific namespace to reduce the scan scope.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-slate-500">
          {search ? 'No workloads match your search' : 'No workloads found. Only namespaces with FeatureFlags are shown.'}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-2">{filtered.length} workloads found</p>
          {filtered.map((wl) => (
            <WorkloadCard key={`${wl.namespace}/${wl.name}`} workload={wl}
              expanded={expandedWorkload === `${wl.namespace}/${wl.name}`}
              onToggle={() => setExpandedWorkload(expandedWorkload === `${wl.namespace}/${wl.name}` ? null : `${wl.namespace}/${wl.name}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkloadCard({ workload, expanded, onToggle }: { workload: DiscoveredWorkload; expanded: boolean; onToggle: () => void }) {
  const containers = (workload.containers ?? []).map((c) => ({
    ...c,
    envVars: c.envVars ?? [],
    configMapRefs: c.configMapRefs ?? [],
  }))
  const kindColor: Record<string, string> = {
    Deployment: 'bg-indigo-500/10 text-indigo-400',
    StatefulSet: 'bg-violet-500/10 text-violet-400',
    DaemonSet: 'bg-amber-500/10 text-amber-400',
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-smooth">
        <div className="flex items-center gap-3">
          <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          <span className="text-sm font-medium text-slate-200">{workload.name}</span>
          <span className="text-xs text-slate-500">{workload.namespace}</span>
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${kindColor[workload.kind] || 'bg-slate-500/10 text-slate-400'}`}>{workload.kind}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {(workload.matchingFlags?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-indigo-400">
              <Flag className="h-3 w-3" />
              {workload.matchingFlags!.length} flags
            </span>
          )}
          <span>{workload.replicas ?? 0} replicas</span>
          <span>{containers.length} containers</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/[0.04] px-5 pb-5">
          {(workload.matchingFlags?.length ?? 0) > 0 && (
            <div className="mt-4 mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Matching Feature Flags</p>
              <div className="flex flex-wrap gap-1.5">
                {workload.matchingFlags!.map((flagName) => (
                  <span key={flagName} className="flex items-center gap-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-xs font-mono text-indigo-400">
                    <Flag className="h-3 w-3" />
                    {flagName}
                  </span>
                ))}
              </div>
            </div>
          )}
          {containers.map((container) => (
            <div key={container.name} className="mt-4">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">
                <span className="font-mono">{container.name}</span>
                <span className="ml-2 font-normal text-slate-500">{container.image}</span>
              </h4>
              {container.envVars.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Feature Flag Variables</p>
                  <div className="rounded-lg border border-white/[0.04] divide-y divide-white/[0.04] text-xs">
                    {container.envVars.map((env) => (
                      <div key={env.name} className="flex items-center justify-between px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-300">{env.name}</span>
                          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400">FLAG</span>
                        </div>
                        <span className="font-mono text-slate-400">{env.isMasked ? '(from secret)' : env.value || '(empty)'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {container.configMapRefs.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Vexil ConfigMaps</p>
                  <div className="flex flex-wrap gap-1.5">
                    {container.configMapRefs.map((ref) => (
                      <span key={`${ref.name}/${ref.key}`} className="rounded-md bg-slate-800/60 px-2 py-0.5 text-xs font-mono text-slate-400">
                        {ref.name}{ref.key ? `/${ref.key}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
