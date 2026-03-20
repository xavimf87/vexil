'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flagsApi, clustersApi } from '@/lib/api-client'
import { X } from 'lucide-react'
import type { FlagType } from '@/lib/types'

interface CreateFlagModalProps {
  onClose: () => void
}

export function CreateFlagModal({ onClose }: CreateFlagModalProps) {
  const queryClient = useQueryClient()
  const { data: clusters = [] } = useQuery({ queryKey: ['clusters'], queryFn: () => clustersApi.list() })

  const [form, setForm] = useState({
    name: '',
    namespace: 'default',
    clusterId: '',
    type: 'boolean' as FlagType,
    defaultValue: 'false',
    description: '',
    owner: '',
    deliveryMethod: 'envVar' as 'envVar' | 'configMap' | 'none',
    envVarName: '',
    selectorLabels: '',
    configMapName: '',
    configMapKey: '',
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const delivery: Record<string, unknown> = {}

      if (form.deliveryMethod === 'envVar' && form.selectorLabels) {
        const labels = Object.fromEntries(
          form.selectorLabels.split(',').map((l) => l.trim().split('='))
        )
        delivery.envVar = {
          name: form.envVarName || undefined,
          selector: { matchLabels: labels },
        }
      } else if (form.deliveryMethod === 'configMap' && form.configMapName) {
        const labels = form.selectorLabels
          ? Object.fromEntries(form.selectorLabels.split(',').map((l) => l.trim().split('=')))
          : {}
        delivery.configMap = {
          configMapName: form.configMapName,
          key: form.configMapKey || form.name,
          selector: { matchLabels: labels },
        }
      }

      return flagsApi.create({
        name: form.name,
        namespace: form.namespace,
        clusterId: form.clusterId,
        type: form.type,
        defaultValue: form.defaultValue,
        description: form.description || undefined,
        owner: form.owner || undefined,
        delivery: Object.keys(delivery).length > 0 ? delivery as any : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl glass p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Create Feature Flag</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
          className="space-y-4"
        >
          {/* Cluster */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Cluster</label>
            <select
              value={form.clusterId}
              onChange={(e) => setForm({ ...form, clusterId: e.target.value })}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
              required
            >
              <option value="">Select cluster...</option>
              {clusters?.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>

          {/* Name & Namespace */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="my-feature-flag"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Namespace</label>
              <input
                type="text"
                value={form.namespace}
                onChange={(e) => setForm({ ...form, namespace: e.target.value })}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                required
              />
            </div>
          </div>

          {/* Type & Default Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as FlagType
                  const defaults: Record<FlagType, string> = {
                    boolean: 'false',
                    string: '',
                    integer: '0',
                    json: '{}',
                  }
                  setForm({ ...form, type, defaultValue: defaults[type] })
                }}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
              >
                <option value="boolean">Boolean</option>
                <option value="string">String</option>
                <option value="integer">Integer</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Default Value</label>
              {form.type === 'boolean' ? (
                <select
                  value={form.defaultValue}
                  onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={form.defaultValue}
                  onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm font-mono"
                />
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this flag control?"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
            />
          </div>

          {/* Delivery Method */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Delivery Method</label>
            <select
              value={form.deliveryMethod}
              onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value as any })}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
            >
              <option value="envVar">Environment Variable</option>
              <option value="configMap">ConfigMap</option>
              <option value="none">None (manual)</option>
            </select>
          </div>

          {/* Delivery-specific fields */}
          {form.deliveryMethod !== 'none' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Target Labels <span className="text-slate-500">(comma-separated: app=frontend,env=prod)</span>
              </label>
              <input
                type="text"
                value={form.selectorLabels}
                onChange={(e) => setForm({ ...form, selectorLabels: e.target.value })}
                placeholder="app=my-app"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
              />
            </div>
          )}

          {form.deliveryMethod === 'configMap' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ConfigMap Name</label>
                <input
                  type="text"
                  value={form.configMapName}
                  onChange={(e) => setForm({ ...form, configMapName: e.target.value })}
                  placeholder="vexil-flags"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Key</label>
                <input
                  type="text"
                  value={form.configMapKey}
                  onChange={(e) => setForm({ ...form, configMapKey: e.target.value })}
                  placeholder={form.name || 'flag-key'}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          )}

          {/* Owner */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Owner</label>
            <input
              type="text"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder="team-name"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
            />
          </div>

          {/* Error */}
          {createMutation.isError && (
            <p className="text-sm text-red-400">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create flag'}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-xs font-medium text-slate-400 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Flag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
