'use client'

import { useQuery } from '@tanstack/react-query'
import { flagsApi, clustersApi, auditApi } from '@/lib/api-client'
import { Flag, Server, Activity, ToggleRight, ArrowUpRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'

export default function Dashboard() {
  const { data: flags = [] } = useQuery({ queryKey: ['flags'], queryFn: () => flagsApi.list() })
  const { data: clusters = [] } = useQuery({ queryKey: ['clusters'], queryFn: () => clustersApi.list() })
  const { data: audit = [] } = useQuery({ queryKey: ['audit'], queryFn: () => auditApi.list() })

  const stats = [
    {
      name: 'Total Flags',
      value: flags?.length ?? 0,
      icon: Flag,
      gradient: 'from-indigo-500 to-blue-600',
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-400',
    },
    {
      name: 'Active Flags',
      value: flags?.filter((f) => f.phase === 'Active')?.length ?? 0,
      icon: ToggleRight,
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
    },
    {
      name: 'Clusters',
      value: clusters?.filter((c) => c.status === 'Connected')?.length ?? 0,
      icon: Server,
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-500/10',
      text: 'text-violet-400',
    },
    {
      name: 'Targeted Workloads',
      value: flags?.reduce((acc, f) => acc + (f.targetedWorkloads ?? 0), 0) ?? 0,
      icon: Activity,
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Overview of your feature flags platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="glass rounded-xl p-5 transition-smooth glass-hover">
            <div className="flex items-center justify-between">
              <div className={`rounded-lg ${stat.bg} p-2.5`}>
                <stat.icon className={`h-5 w-5 ${stat.text}`} />
              </div>
              <span className="text-3xl font-bold text-white">{stat.value}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{stat.name}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Flags */}
        <div className="lg:col-span-2 glass rounded-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Feature Flags</h2>
            <Link href="/flags" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-smooth">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {flags && flags.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {flags.slice(0, 6).map((flag) => (
                <div key={`${flag.namespace}/${flag.name}`} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-smooth">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      flag.disabled ? 'bg-slate-500' :
                      flag.defaultValue === 'true' ? 'bg-emerald-400 animate-pulse-dot' :
                      flag.defaultValue === 'false' ? 'bg-slate-500' :
                      'bg-indigo-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{flag.name}</p>
                      <p className="text-xs text-slate-500">{flag.namespace} / {flag.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-xs font-mono text-slate-300">
                      {flag.defaultValue.length > 20 ? flag.defaultValue.slice(0, 20) + '...' : flag.defaultValue}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      flag.phase === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                      flag.phase === 'Disabled' ? 'bg-slate-500/10 text-slate-400' :
                      flag.phase === 'Failed' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {flag.phase || 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">
              No flags yet. <Link href="/flags" className="text-indigo-400 hover:underline">Create your first flag</Link>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="glass rounded-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <Link href="/audit" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-smooth">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {audit && audit.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {audit.slice(0, 8).map((event) => (
                <div key={event.id} className="flex items-start gap-3 px-5 py-3">
                  <div className={`mt-0.5 rounded-full p-1 ${
                    event.action === 'create' ? 'bg-emerald-500/10 text-emerald-400' :
                    event.action === 'delete' ? 'bg-red-500/10 text-red-400' :
                    event.action === 'toggle' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-indigo-500/10 text-indigo-400'
                  }`}>
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300">
                      <span className="font-medium">{event.action}</span> {event.resource}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{event.resourceId}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">{timeAgo(event.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">No activity yet</div>
          )}
        </div>
      </div>

      {/* Clusters row */}
      {clusters && clusters.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Connected Clusters</h2>
            <Link href="/clusters" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
              Manage <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="glass rounded-xl p-4 transition-smooth glass-hover">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${
                    cluster.status === 'Connected' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}>
                    <Server className={`h-4 w-4 ${
                      cluster.status === 'Connected' ? 'text-emerald-400' : 'text-red-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{cluster.displayName}</p>
                    <p className="text-xs text-slate-500">{cluster.id}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-lg font-bold text-white">{cluster.discoveredWorkloads}</p>
                    <p className="text-[10px] text-slate-500">workloads</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
