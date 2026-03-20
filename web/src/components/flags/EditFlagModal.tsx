'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flagsApi } from '@/lib/api-client'
import { X, Plus, Trash2, Check } from 'lucide-react'
import type { FeatureFlag, TargetingRule, Condition, FlagType } from '@/lib/types'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface EditFlagModalProps {
  flag: FeatureFlag
  onClose: () => void
}

export function EditFlagModal({ flag, onClose }: EditFlagModalProps) {
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    description: flag.description || '',
    defaultValue: flag.defaultValue,
    disabled: flag.disabled,
    owner: flag.owner || '',
    deliveryMethod: flag.delivery?.envVar ? 'envVar' : flag.delivery?.configMap ? 'configMap' : 'none',
    envVarName: flag.delivery?.envVar?.name || '',
    selectorLabels: flag.delivery?.envVar?.selector?.matchLabels
      ? Object.entries(flag.delivery.envVar.selector.matchLabels).map(([k, v]) => `${k}=${v}`).join(',')
      : flag.delivery?.configMap?.selector?.matchLabels
        ? Object.entries(flag.delivery.configMap.selector.matchLabels).map(([k, v]) => `${k}=${v}`).join(',')
        : '',
    configMapName: flag.delivery?.configMap?.configMapName || '',
    configMapKey: flag.delivery?.configMap?.key || '',
  })

  const [rules, setRules] = useState<TargetingRule[]>(flag.rules || [])
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  const updateMutation = useMutation({
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
          key: form.configMapKey || flag.name,
          selector: { matchLabels: labels },
        }
      }

      return flagsApi.update(flag.namespace, flag.name, flag.clusterId, {
        description: form.description || undefined,
        defaultValue: form.defaultValue,
        disabled: form.disabled,
        owner: form.owner || undefined,
        delivery: Object.keys(delivery).length > 0 ? delivery as any : undefined,
        rules: rules.length > 0 ? rules : undefined,
      } as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] })
      onClose()
    },
  })

  const addRule = () => {
    setRules([...rules, {
      name: '',
      conditions: [{ attribute: '', operator: 'eq', values: [''] }],
      value: '',
    }])
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const updateRule = (index: number, field: string, value: any) => {
    const updated = [...rules]
    ;(updated[index] as any)[field] = value
    setRules(updated)
  }

  const updateCondition = (ruleIdx: number, condIdx: number, field: string, value: any) => {
    const updated = [...rules]
    ;(updated[ruleIdx].conditions[condIdx] as any)[field] = value
    setRules(updated)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-xl glass p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Flag: {flag.name}</h2>
            <p className="text-xs text-slate-500">{flag.namespace} / {flag.clusterId}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setShowSaveConfirm(true) }}
          className="space-y-5"
        >
          {/* Value + Disabled */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Default Value</label>
              {flag.type === 'boolean' ? (
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
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.disabled}
                  onChange={(e) => setForm({ ...form, disabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 text-indigo-600 bg-slate-800"
                />
                <span className="text-xs font-medium text-slate-400">Kill switch (disable globally)</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
            />
          </div>

          {/* Owner */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Owner</label>
            <input
              type="text"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
            />
          </div>

          {/* Delivery */}
          <div className="border-t border-white/[0.06] pt-4">
            <h3 className="text-sm font-semibold text-white mb-3">Delivery</h3>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Method</label>
              <select
                value={form.deliveryMethod}
                onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value as any })}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
              >
                <option value="envVar">Environment Variable</option>
                <option value="configMap">ConfigMap</option>
                <option value="none">None</option>
              </select>
            </div>

            {form.deliveryMethod !== 'none' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Labels</label>
                <input
                  type="text"
                  value={form.selectorLabels}
                  onChange={(e) => setForm({ ...form, selectorLabels: e.target.value })}
                  placeholder="app=my-app,env=prod"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                />
              </div>
            )}

            {form.deliveryMethod === 'envVar' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">Env Var Name (optional)</label>
                <input
                  type="text"
                  value={form.envVarName}
                  onChange={(e) => setForm({ ...form, envVarName: e.target.value })}
                  placeholder={`FLAG_${flag.name.toUpperCase().replace(/-/g, '_')}`}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm font-mono"
                />
              </div>
            )}

            {form.deliveryMethod === 'configMap' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">ConfigMap Name</label>
                  <input
                    type="text"
                    value={form.configMapName}
                    onChange={(e) => setForm({ ...form, configMapName: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Key</label>
                  <input
                    type="text"
                    value={form.configMapKey}
                    onChange={(e) => setForm({ ...form, configMapKey: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Targeting Rules */}
          <div className="border-t border-white/[0.06] pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Targeting Rules</h3>
              <button
                type="button"
                onClick={addRule}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <Plus className="h-3.5 w-3.5" /> Add Rule
              </button>
            </div>

            {rules.length === 0 ? (
              <p className="text-sm text-slate-500">No targeting rules. All matching workloads get the default value.</p>
            ) : (
              <div className="space-y-4">
                {rules.map((rule, ruleIdx) => (
                  <div key={ruleIdx} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={rule.name}
                        onChange={(e) => updateRule(ruleIdx, 'name', e.target.value)}
                        placeholder="Rule name"
                        className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-sm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => removeRule(ruleIdx)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Conditions */}
                    {rule.conditions.map((cond, condIdx) => (
                      <div key={condIdx} className="grid grid-cols-3 gap-2 mb-2">
                        <input
                          type="text"
                          value={cond.attribute}
                          onChange={(e) => updateCondition(ruleIdx, condIdx, 'attribute', e.target.value)}
                          placeholder="namespace, label:app"
                          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-xs font-mono"
                        />
                        <select
                          value={cond.operator}
                          onChange={(e) => updateCondition(ruleIdx, condIdx, 'operator', e.target.value)}
                          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-xs"
                        >
                          <option value="eq">equals</option>
                          <option value="neq">not equals</option>
                          <option value="in">in</option>
                          <option value="notin">not in</option>
                          <option value="matches">matches</option>
                        </select>
                        <input
                          type="text"
                          value={cond.values.join(',')}
                          onChange={(e) => updateCondition(ruleIdx, condIdx, 'values', e.target.value.split(','))}
                          placeholder="value1,value2"
                          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    ))}

                    {/* Rule value */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-500">Return:</span>
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => updateRule(ruleIdx, 'value', e.target.value)}
                        placeholder="value when matched"
                        className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-sm font-mono"
                      />
                      {rule.percentage !== undefined && (
                        <>
                          <span className="text-xs text-slate-500">at</span>
                          <input
                            type="number"
                            value={rule.percentage}
                            onChange={(e) => updateRule(ruleIdx, 'percentage', parseInt(e.target.value))}
                            className="w-16 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-sm"
                            min={0} max={100}
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {updateMutation.isError && (
            <p className="text-sm text-red-400">
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update flag'}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {showSaveConfirm && (
          <ConfirmModal
            title="Save Changes"
            message={`Apply changes to "${flag.name}"? This will update the flag across all targeted workloads.`}
            confirmLabel="Save Changes"
            variant="info"
            onConfirm={() => {
              setShowSaveConfirm(false)
              updateMutation.mutate()
            }}
            onCancel={() => setShowSaveConfirm(false)}
          />
        )}
      </div>
    </div>
  )
}
