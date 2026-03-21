'use client'

import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { ScrollText, Search, X } from 'lucide-react'
import { useState, useMemo } from 'react'

export default function AuditPage() {
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.list(),
  })

  const filtered = useMemo(() => {
    if (!events) return []
    return events.filter((e) => {
      if (search && !e.resourceId.toLowerCase().includes(search.toLowerCase()) &&
          !e.resource.toLowerCase().includes(search.toLowerCase())) return false
      if (filterAction && e.action !== filterAction) return false
      return true
    })
  }, [events, search, filterAction])

  const actionStyle: Record<string, string> = {
    create: 'bg-emerald-500/10 text-emerald-400',
    update: 'bg-indigo-500/10 text-indigo-400',
    delete: 'bg-red-500/10 text-red-400',
    toggle: 'bg-amber-500/10 text-amber-400',
    register: 'bg-violet-500/10 text-violet-400',
    remove: 'bg-slate-500/10 text-slate-400',
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-slate-400 mt-1">Track all changes across your platform</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by resource..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm" />
        </div>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm">
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="toggle">Toggle</option>
        </select>
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
            <ScrollText className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white">No audit events</h3>
          <p className="mt-2 text-sm text-slate-400">Actions will appear here as you manage your flags.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Timestamp</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resource</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resource ID</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cluster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((event) => (
                <tr key={event.id} className="hover:bg-white/[0.02] transition-smooth">
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(event.timestamp)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${actionStyle[event.action] || 'bg-slate-500/10 text-slate-400'}`}>
                      {event.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{event.resource}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{event.resourceId}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{event.cluster || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
