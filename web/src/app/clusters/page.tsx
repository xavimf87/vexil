'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clustersApi } from '@/lib/api-client'
import { Plus, Server, Trash2, Wifi, WifiOff, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useAuth } from '@/lib/auth'

export default function ClustersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [showRegister, setShowRegister] = useState(false)
  const [removingCluster, setRemovingCluster] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({ id: '', displayName: '', apiServer: '', kubeconfig: '' })

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => clustersApi.list(),
  })

  const registerMutation = useMutation({
    mutationFn: () => clustersApi.register(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      setShowRegister(false)
      setForm({ id: '', displayName: '', apiServer: '', kubeconfig: '' })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => clustersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clusters'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clusters</h1>
          <p className="text-sm text-slate-400 mt-1">{clusters?.length || 0} connected clusters</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowRegister(!showRegister)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-smooth shadow-lg shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            Register Cluster
          </button>
        )}
      </div>

      {showRegister && (
        <div className="mb-6 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Register New Cluster</h3>
            <button onClick={() => setShowRegister(false)} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); registerMutation.mutate() }} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Cluster ID</label>
              <input type="text" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="prod-eu-west-1"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
              <input type="text" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Production EU"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm" required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">API Server URL</label>
              <input type="text" value={form.apiServer} onChange={(e) => setForm({ ...form, apiServer: e.target.value })}
                placeholder="https://k8s-api.example.com:6443"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Kubeconfig (YAML)</label>
              <textarea value={form.kubeconfig} onChange={(e) => setForm({ ...form, kubeconfig: e.target.value })}
                rows={5} placeholder="Paste your kubeconfig YAML here..."
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm font-mono" />
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowRegister(false)}
                className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04]">Cancel</button>
              <button type="submit" disabled={registerMutation.isPending}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/20">
                {registerMutation.isPending ? 'Connecting...' : 'Connect Cluster'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        </div>
      ) : !clusters || clusters.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
            <Server className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">No clusters connected</h3>
          <p className="mt-2 text-sm text-slate-400">Register your first Kubernetes cluster to start managing flags.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clusters.map((cluster) => {
            const connected = cluster.status === 'Connected'
            return (
              <div key={cluster.id} className="glass rounded-xl p-5 transition-smooth glass-hover group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${connected ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      {connected ? (
                        <Wifi className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{cluster.displayName}</h3>
                      <p className="text-xs text-slate-500 font-mono">{cluster.id}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setRemovingCluster({ id: cluster.id, name: cluster.displayName })}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-smooth"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Status</span>
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-red-400'}`} />
                      {cluster.status}
                    </span>
                  </div>
                  {cluster.kubernetesVersion && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Version</span>
                      <span className="text-xs font-mono text-slate-300">{cluster.kubernetesVersion}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Workloads</span>
                    <span className="text-sm font-bold text-white">{cluster.discoveredWorkloads}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {removingCluster && (
        <ConfirmModal
          title="Remove Cluster"
          message={`Are you sure you want to disconnect "${removingCluster.name}"? Feature flags targeting this cluster will no longer be managed.`}
          confirmLabel="Remove Cluster"
          variant="danger"
          onConfirm={() => {
            removeMutation.mutate(removingCluster.id)
            setRemovingCluster(null)
          }}
          onCancel={() => setRemovingCluster(null)}
        />
      )}
    </div>
  )
}
