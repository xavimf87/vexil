'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { flagsApi } from '@/lib/api-client'
import type { FeatureFlag } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { Plus, Pencil, ToggleLeft, ToggleRight, Trash2, Search, Filter, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { CreateFlagModal } from '@/components/flags/CreateFlagModal'
import { EditFlagModal } from '@/components/flags/EditFlagModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useAuth } from '@/lib/auth'

export default function FlagsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canEdit = user?.role !== 'viewer'
  const [showCreate, setShowCreate] = useState(false)
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null)
  const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null)
  const [togglingFlag, setTogglingFlag] = useState<FeatureFlag | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterPhase, setFilterPhase] = useState<string>('')
  const queryClient = useQueryClient()

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['flags'],
    queryFn: () => flagsApi.list(),
  })

  const filteredFlags = useMemo(() => {
    if (!flags) return []
    return flags.filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) &&
          !f.description?.toLowerCase().includes(search.toLowerCase()) &&
          !f.namespace?.toLowerCase().includes(search.toLowerCase())) return false
      if (filterType && f.type !== filterType) return false
      if (filterPhase && (f.phase || 'Pending') !== filterPhase) return false
      return true
    })
  }, [flags, search, filterType, filterPhase])

  const toggleMutation = useMutation({
    mutationFn: (flag: FeatureFlag) => flagsApi.toggle(flag.namespace, flag.name, flag.clusterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flags'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (flag: FeatureFlag) => flagsApi.delete(flag.namespace, flag.name, flag.clusterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flags'] }),
  })

  const hasFilters = search || filterType || filterPhase

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
          <p className="text-sm text-slate-400 mt-1">
            {flags?.length ?? 0} flags across all clusters
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-smooth shadow-lg shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            Create Flag
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flags by name, description or namespace..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-smooth"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
        >
          <option value="">All types</option>
          <option value="boolean">Boolean</option>
          <option value="string">String</option>
          <option value="integer">Integer</option>
          <option value="json">JSON</option>
        </select>
        <select
          value={filterPhase}
          onChange={(e) => setFilterPhase(e.target.value)}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
        >
          <option value="">All phases</option>
          <option value="Active">Active</option>
          <option value="Disabled">Disabled</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterPhase('') }}
            className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-2.5 text-xs text-slate-400 hover:bg-white/[0.04] transition-smooth"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">Loading flags...</p>
        </div>
      ) : !flags || flags.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
            <ToggleLeft className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">No feature flags</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
            Get started by creating your first feature flag to control your application behavior.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
            >
              Create Your First Flag
            </button>
          )}
        </div>
      ) : (
        <>
          {hasFilters && (
            <p className="mb-3 text-xs text-slate-500">{filteredFlags.length} of {flags.length} flags</p>
          )}
          <div className="glass rounded-xl overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Flag</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Value</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Age</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredFlags.map((flag) => (
                  <tr key={`${flag.clusterId}/${flag.namespace}/${flag.name}`} className="hover:bg-white/[0.02] transition-smooth group">
                    <td className="px-5 py-3.5 cursor-pointer" onClick={() => setEditingFlag(flag)}>
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          flag.disabled ? 'bg-slate-600' :
                          flag.defaultValue === 'true' ? 'bg-emerald-400' :
                          flag.defaultValue === 'false' ? 'bg-slate-500' :
                          'bg-indigo-400'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-slate-200 group-hover:text-indigo-400 transition-smooth">{flag.name}</p>
                          <p className="text-[11px] text-slate-500">{flag.namespace} / {flag.clusterId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-slate-800/60 px-2 py-0.5 text-[11px] font-mono text-slate-400">{flag.type}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium ${
                        flag.defaultValue === 'true' ? 'bg-emerald-500/10 text-emerald-400' :
                        flag.defaultValue === 'false' ? 'bg-slate-700/50 text-slate-400' :
                        'bg-slate-800/60 text-slate-300'
                      }`}>
                        {flag.defaultValue.length > 25 ? flag.defaultValue.slice(0, 25) + '...' : flag.defaultValue}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        flag.phase === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                        flag.phase === 'Disabled' ? 'bg-slate-500/10 text-slate-400' :
                        flag.phase === 'Failed' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          flag.phase === 'Active' ? 'bg-emerald-400' :
                          flag.phase === 'Disabled' ? 'bg-slate-400' :
                          flag.phase === 'Failed' ? 'bg-red-400' :
                          'bg-amber-400'
                        }`} />
                        {flag.phase || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{timeAgo(flag.createdAt)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                        {canEdit && (
                          <button
                            onClick={() => setEditingFlag(flag)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-500/10 hover:text-indigo-400 transition-smooth"
                            title="Edit flag"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canEdit && flag.type === 'boolean' && (
                          <button
                            onClick={() => setTogglingFlag(flag)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-smooth"
                            title="Toggle flag"
                          >
                            {flag.defaultValue === 'true' ? (
                              <ToggleRight className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setDeletingFlag(flag)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-smooth"
                            title="Delete flag"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showCreate && <CreateFlagModal onClose={() => setShowCreate(false)} />}
      {editingFlag && <EditFlagModal flag={editingFlag} onClose={() => setEditingFlag(null)} />}

      {deletingFlag && (
        <ConfirmModal
          title="Delete Feature Flag"
          message={`Are you sure you want to delete "${deletingFlag.name}"? This will remove the flag from the cluster and may affect running workloads.`}
          confirmLabel="Delete Flag"
          variant="danger"
          onConfirm={() => {
            deleteMutation.mutate(deletingFlag)
            setDeletingFlag(null)
          }}
          onCancel={() => setDeletingFlag(null)}
        />
      )}

      {togglingFlag && (
        <ConfirmModal
          title="Toggle Feature Flag"
          message={`Toggle "${togglingFlag.name}" from ${togglingFlag.defaultValue} to ${togglingFlag.defaultValue === 'true' ? 'false' : 'true'}? This change will be applied to all targeted workloads.`}
          confirmLabel={`Set to ${togglingFlag.defaultValue === 'true' ? 'false' : 'true'}`}
          variant="warning"
          onConfirm={() => {
            toggleMutation.mutate(togglingFlag)
            setTogglingFlag(null)
          }}
          onCancel={() => setTogglingFlag(null)}
        />
      )}
    </div>
  )
}
