'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flagsApi } from '@/lib/api-client'
import { X, Plus, Trash2, Check, Info, ChevronDown, ChevronUp, Zap, GitBranch } from 'lucide-react'
import type { FeatureFlag, TargetingRule } from '@/lib/types'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface EditFlagModalProps {
  flag: FeatureFlag
  onClose: () => void
}

const operatorLabels: Record<string, { label: string; desc: string }> = {
  eq: { label: 'equals', desc: 'Exact match' },
  neq: { label: 'not equals', desc: 'Anything except this value' },
  in: { label: 'is one of', desc: 'Matches any value in the list' },
  notin: { label: 'is not one of', desc: 'Does not match any value in the list' },
  matches: { label: 'matches regex', desc: 'Regular expression match' },
}

const attributeExamples = [
  { value: 'label:tier', desc: 'Workload label "tier"' },
  { value: 'label:env', desc: 'Workload label "env"' },
  { value: 'label:app', desc: 'Workload label "app"' },
  { value: 'namespace', desc: 'Namespace name' },
  { value: 'workload-name', desc: 'Name of the Deployment/StatefulSet' },
]

const inputClass = 'w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-smooth'

export function EditFlagModal({ flag, onClose }: EditFlagModalProps) {
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    description: flag.description || '',
    defaultValue: flag.defaultValue,
    disabled: flag.disabled,
    deliveryMethod: flag.delivery?.envVar ? 'envVar' : flag.delivery?.configMap ? 'configMap' : flag.delivery?.sidecar ? 'sidecar' : 'none',
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
  const [expandedRule, setExpandedRule] = useState<number | null>(rules.length > 0 ? 0 : null)
  const [showRulesHelp, setShowRulesHelp] = useState(false)

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
      } else if (form.deliveryMethod === 'sidecar' && form.selectorLabels) {
        const labels = Object.fromEntries(
          form.selectorLabels.split(',').map((l) => l.trim().split('='))
        )
        delivery.sidecar = {
          selector: { matchLabels: labels },
        }
      }

      return flagsApi.update(flag.namespace, flag.name, flag.clusterId, {
        description: form.description || undefined,
        defaultValue: form.defaultValue,
        disabled: form.disabled,
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
    const newIdx = rules.length
    setRules([...rules, {
      name: `Rule ${newIdx + 1}`,
      conditions: [{ attribute: 'label:tier', operator: 'eq', values: [''] }],
      value: flag.type === 'boolean' ? 'true' : '',
    }])
    setExpandedRule(newIdx)
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
    setExpandedRule(null)
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

  const addCondition = (ruleIdx: number) => {
    const updated = [...rules]
    updated[ruleIdx].conditions.push({ attribute: '', operator: 'eq', values: [''] })
    setRules(updated)
  }

  const removeCondition = (ruleIdx: number, condIdx: number) => {
    const updated = [...rules]
    updated[ruleIdx].conditions = updated[ruleIdx].conditions.filter((_, i) => i !== condIdx)
    setRules(updated)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-xl glass p-6 shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit: {flag.name}</h2>
            <p className="text-xs text-slate-500">{flag.namespace} / {flag.clusterId} / {flag.type}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setShowSaveConfirm(true) }} className="space-y-5">

          {/* ── Value & Status ──────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Value & Status</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Default value</label>
                {flag.type === 'boolean' ? (
                  <select value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} className={inputClass}>
                    <option value="false">false (off)</option>
                    <option value="true">true (on)</option>
                  </select>
                ) : (
                  <input type="text" value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} className={`${inputClass} font-mono`} />
                )}
                <p className="text-[10px] text-slate-600 mt-1">Workloads that don't match any rule get this value.</p>
              </div>
              <div className="flex flex-col justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.04] transition-smooth">
                  <input
                    type="checkbox"
                    checked={form.disabled}
                    onChange={(e) => setForm({ ...form, disabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 text-red-600 bg-slate-800 focus:ring-red-500/30"
                  />
                  <div>
                    <span className="text-xs font-medium text-slate-300">Kill switch</span>
                    <p className="text-[10px] text-slate-600">Disable this flag globally. No workload receives it.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <input
              type="text" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this flag control?"
              className={inputClass}
            />
          </div>

          {/* ── Delivery ───────────────────────────────────── */}
          <div className="border-t border-white/[0.06] pt-4">
            <h3 className="text-sm font-semibold text-white mb-3">Delivery</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Method</label>
                <select value={form.deliveryMethod} onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value as any })} className={inputClass}>
                  <option value="envVar">Environment Variable</option>
                  <option value="configMap">ConfigMap</option>
                  <option value="sidecar">Sidecar API</option>
                  <option value="none">None (manual)</option>
                </select>
              </div>

              {form.deliveryMethod !== 'none' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Target workloads by labels</label>
                  <input type="text" value={form.selectorLabels} onChange={(e) => setForm({ ...form, selectorLabels: e.target.value })} placeholder="app=my-app,env=prod" className={inputClass} />
                  <p className="text-[10px] text-slate-600 mt-1">Workloads in <span className="font-mono text-slate-400">{flag.namespace}</span> with these labels will receive the flag.</p>
                </div>
              )}

              {form.deliveryMethod === 'envVar' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Env var name <span className="text-slate-600">(auto if empty)</span></label>
                  <input type="text" value={form.envVarName} onChange={(e) => setForm({ ...form, envVarName: e.target.value })}
                    placeholder={`FLAG_${flag.name.toUpperCase().replace(/-/g, '_')}`} className={`${inputClass} font-mono`} />
                </div>
              )}

              {form.deliveryMethod === 'configMap' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">ConfigMap name</label>
                    <input type="text" value={form.configMapName} onChange={(e) => setForm({ ...form, configMapName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Key</label>
                    <input type="text" value={form.configMapKey} onChange={(e) => setForm({ ...form, configMapKey: e.target.value })} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Targeting Rules ─────────────────────────────── */}
          <div className="border-t border-white/[0.06] pt-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Targeting Rules</h3>
                <span className="text-[10px] text-slate-600">(optional)</span>
              </div>
              <button type="button" onClick={() => setShowRulesHelp(!showRulesHelp)} className="text-slate-500 hover:text-slate-300 transition-smooth">
                <Info className="h-4 w-4" />
              </button>
            </div>

            {/* Help section */}
            {showRulesHelp && (
              <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/[0.04] p-3 mb-3 space-y-3">
                <div>
                  <p className="text-xs text-slate-300 mb-1 font-medium">What are targeting rules?</p>
                  <p className="text-[11px] text-slate-400">
                    Rules let you return <strong className="text-slate-200">different values</strong> of this flag depending on workload properties (labels, namespace, name).
                    Without rules, every workload gets the default value. Rules are evaluated top-to-bottom — <strong className="text-slate-200">first match wins</strong>.
                  </p>
                </div>

                {/* Example 1 */}
                <div className="rounded-md bg-slate-900/60 p-2.5 text-[11px] text-slate-400 space-y-1">
                  <p className="text-slate-300 font-medium">Example 1: Different rate limits by tier</p>
                  <p>Flag: <span className="font-mono text-indigo-400">api-rate-limit</span> (integer, default: <span className="font-mono">100</span>)</p>
                  <div className="border-l-2 border-amber-500/30 pl-2 space-y-0.5">
                    <p><span className="text-amber-400">1.</span> If <span className="font-mono text-slate-300">label:tier</span> <span className="text-emerald-400">equals</span> <span className="font-mono text-slate-300">premium</span> → <span className="font-mono text-indigo-400">1000</span></p>
                    <p><span className="text-amber-400">2.</span> If <span className="font-mono text-slate-300">label:tier</span> <span className="text-emerald-400">equals</span> <span className="font-mono text-slate-300">free</span> → <span className="font-mono text-indigo-400">10</span></p>
                    <p className="text-slate-600">Otherwise → <span className="font-mono">100</span></p>
                  </div>
                </div>

                {/* Example 2 */}
                <div className="rounded-md bg-slate-900/60 p-2.5 text-[11px] text-slate-400 space-y-1">
                  <p className="text-slate-300 font-medium">Example 2: Enable feature only in staging</p>
                  <p>Flag: <span className="font-mono text-indigo-400">new-checkout</span> (boolean, default: <span className="font-mono">false</span>)</p>
                  <div className="border-l-2 border-amber-500/30 pl-2 space-y-0.5">
                    <p><span className="text-amber-400">1.</span> If <span className="font-mono text-slate-300">label:env</span> <span className="text-emerald-400">equals</span> <span className="font-mono text-slate-300">staging</span> → <span className="font-mono text-indigo-400">true</span></p>
                    <p className="text-slate-600">Otherwise → <span className="font-mono">false</span> (disabled in prod)</p>
                  </div>
                </div>

                {/* Example 3 */}
                <div className="rounded-md bg-slate-900/60 p-2.5 text-[11px] text-slate-400 space-y-1">
                  <p className="text-slate-300 font-medium">Example 3: Multiple conditions (AND)</p>
                  <p>Flag: <span className="font-mono text-indigo-400">debug-mode</span> (boolean, default: <span className="font-mono">false</span>)</p>
                  <div className="border-l-2 border-amber-500/30 pl-2 space-y-0.5">
                    <p><span className="text-amber-400">1.</span> If <span className="font-mono text-slate-300">label:env</span> <span className="text-emerald-400">is one of</span> <span className="font-mono text-slate-300">dev, staging</span></p>
                    <p className="pl-3"><span className="text-amber-400/60 text-[9px] font-bold">AND</span> <span className="font-mono text-slate-300">label:team</span> <span className="text-emerald-400">equals</span> <span className="font-mono text-slate-300">backend</span></p>
                    <p className="pl-3">→ <span className="font-mono text-indigo-400">true</span></p>
                    <p className="text-slate-600">Otherwise → <span className="font-mono">false</span></p>
                  </div>
                </div>

                {/* Example 4 */}
                <div className="rounded-md bg-slate-900/60 p-2.5 text-[11px] text-slate-400 space-y-1">
                  <p className="text-slate-300 font-medium">Example 4: Config by workload name</p>
                  <p>Flag: <span className="font-mono text-indigo-400">log-level</span> (string, default: <span className="font-mono">info</span>)</p>
                  <div className="border-l-2 border-amber-500/30 pl-2 space-y-0.5">
                    <p><span className="text-amber-400">1.</span> If <span className="font-mono text-slate-300">workload-name</span> <span className="text-emerald-400">matches regex</span> <span className="font-mono text-slate-300">.*-gateway</span> → <span className="font-mono text-indigo-400">debug</span></p>
                    <p><span className="text-amber-400">2.</span> If <span className="font-mono text-slate-300">namespace</span> <span className="text-emerald-400">equals</span> <span className="font-mono text-slate-300">production</span> → <span className="font-mono text-indigo-400">warn</span></p>
                    <p className="text-slate-600">Otherwise → <span className="font-mono">info</span></p>
                  </div>
                </div>

                {/* Attributes reference */}
                <div>
                  <p className="text-[10px] font-medium text-slate-500 mb-1.5">Available attributes:</p>
                  <div className="space-y-1">
                    {attributeExamples.map((a) => (
                      <div key={a.value} className="flex items-center gap-2">
                        <span className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">{a.value}</span>
                        <span className="text-[10px] text-slate-500">{a.desc}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">label:&lt;key&gt;</span>
                      <span className="text-[10px] text-slate-500">Any custom label on the workload</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">annotation:&lt;key&gt;</span>
                      <span className="text-[10px] text-slate-500">Any annotation on the workload</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {rules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
                <p className="text-xs text-slate-500 mb-2">No rules — all workloads get the default value <span className="font-mono text-slate-400">{form.defaultValue}</span></p>
                <button type="button" onClick={addRule} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 px-3 py-2 text-xs font-medium text-indigo-400 hover:bg-indigo-600/20 transition-smooth">
                  <Plus className="h-3.5 w-3.5" /> Add a targeting rule
                </button>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {rules.map((rule, ruleIdx) => {
                  const isExpanded = expandedRule === ruleIdx
                  const conditionSummary = rule.conditions.map((c) => {
                    const vals = c.values.filter(Boolean).join(', ')
                    return `${c.attribute || '?'} ${operatorLabels[c.operator]?.label || c.operator} ${vals || '?'}`
                  }).join(' AND ')

                  return (
                    <div key={ruleIdx} className={`rounded-lg border transition-smooth ${isExpanded ? 'border-indigo-500/20 bg-indigo-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                      {/* Rule header (collapsed view) */}
                      <button
                        type="button"
                        onClick={() => setExpandedRule(isExpanded ? null : ruleIdx)}
                        className="w-full flex items-center justify-between p-3 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-400">
                            {ruleIdx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{rule.name || `Rule ${ruleIdx + 1}`}</p>
                            {!isExpanded && (
                              <p className="text-[10px] text-slate-500 truncate">
                                If {conditionSummary || '...'} → <span className="text-indigo-400 font-mono">{rule.value || '?'}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        </div>
                      </button>

                      {/* Rule body (expanded) */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 border-t border-white/[0.04]">
                          {/* Rule name */}
                          <div className="pt-3">
                            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Rule name</label>
                            <input
                              type="text" value={rule.name}
                              onChange={(e) => updateRule(ruleIdx, 'name', e.target.value)}
                              placeholder="e.g. Premium users, Staging only"
                              className={`${inputClass} !py-2 !text-xs`}
                            />
                          </div>

                          {/* Conditions */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                                Conditions <span className="normal-case text-slate-600">(all must match)</span>
                              </label>
                              {rule.conditions.length > 0 && (
                                <button type="button" onClick={() => addCondition(ruleIdx)} className="text-[10px] text-indigo-400 hover:text-indigo-300">
                                  + Add condition
                                </button>
                              )}
                            </div>

                            <div className="space-y-2">
                              {rule.conditions.map((cond, condIdx) => (
                                <div key={condIdx} className="rounded-md border border-white/[0.04] bg-white/[0.02] p-2">
                                  {condIdx > 0 && (
                                    <p className="text-[9px] font-bold text-amber-400/60 uppercase tracking-widest mb-1.5">AND</p>
                                  )}
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                                    {/* Attribute */}
                                    <div>
                                      <label className="block text-[10px] text-slate-600 mb-0.5">Check this property</label>
                                      <select
                                        value={cond.attribute}
                                        onChange={(e) => updateCondition(ruleIdx, condIdx, 'attribute', e.target.value)}
                                        className={`${inputClass} !py-1.5 !text-xs !font-mono`}
                                      >
                                        <option value="">Select...</option>
                                        {attributeExamples.map((a) => (
                                          <option key={a.value} value={a.value}>{a.value} — {a.desc}</option>
                                        ))}
                                        {cond.attribute && !attributeExamples.some((a) => a.value === cond.attribute) && (
                                          <option value={cond.attribute}>{cond.attribute} (custom)</option>
                                        )}
                                      </select>
                                    </div>

                                    {/* Operator */}
                                    <div>
                                      <label className="block text-[10px] text-slate-600 mb-0.5">Operator</label>
                                      <select
                                        value={cond.operator}
                                        onChange={(e) => updateCondition(ruleIdx, condIdx, 'operator', e.target.value)}
                                        className={`${inputClass} !py-1.5 !text-xs`}
                                      >
                                        {Object.entries(operatorLabels).map(([op, { label }]) => (
                                          <option key={op} value={op}>{label}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Values */}
                                    <div>
                                      <label className="block text-[10px] text-slate-600 mb-0.5">
                                        {cond.operator === 'in' || cond.operator === 'notin' ? 'Values (comma-separated)' : 'Value'}
                                      </label>
                                      <input
                                        type="text"
                                        value={cond.values.join(',')}
                                        onChange={(e) => updateCondition(ruleIdx, condIdx, 'values', e.target.value.split(','))}
                                        placeholder={cond.operator === 'in' ? 'premium,enterprise' : 'premium'}
                                        className={`${inputClass} !py-1.5 !text-xs !font-mono`}
                                      />
                                    </div>

                                    {/* Remove condition */}
                                    <div className="flex items-end">
                                      {rule.conditions.length > 1 && (
                                        <button type="button" onClick={() => removeCondition(ruleIdx, condIdx)}
                                          className="rounded-md p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-smooth mb-0.5">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Return value */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Then return this value</label>
                            <div className="flex items-center gap-2">
                              {flag.type === 'boolean' ? (
                                <select value={rule.value} onChange={(e) => updateRule(ruleIdx, 'value', e.target.value)} className={`${inputClass} !py-2 !text-xs`}>
                                  <option value="true">true (on)</option>
                                  <option value="false">false (off)</option>
                                </select>
                              ) : (
                                <input type="text" value={rule.value} onChange={(e) => updateRule(ruleIdx, 'value', e.target.value)}
                                  placeholder={flag.type === 'integer' ? '1000' : flag.type === 'json' ? '{"feature": true}' : 'my-value'}
                                  className={`${inputClass} !py-2 !text-xs !font-mono`} />
                              )}
                            </div>
                          </div>

                          {/* Rule actions */}
                          <div className="flex justify-end pt-1">
                            <button type="button" onClick={() => removeRule(ruleIdx)}
                              className="flex items-center gap-1 text-[10px] text-red-400/60 hover:text-red-400 transition-smooth">
                              <Trash2 className="h-3 w-3" /> Remove rule
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add another rule */}
                <button type="button" onClick={addRule}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.08] py-2 text-xs text-slate-500 hover:text-indigo-400 hover:border-indigo-500/20 transition-smooth">
                  <Plus className="h-3.5 w-3.5" /> Add another rule
                </button>

                {/* Visual summary */}
                <div className="rounded-lg bg-slate-900/40 border border-white/[0.04] p-3 text-[11px] text-slate-500">
                  <p className="font-medium text-slate-400 mb-1">Evaluation order:</p>
                  {rules.map((rule, i) => (
                    <p key={i}>
                      <span className="text-amber-400">{i + 1}.</span> {rule.name || `Rule ${i + 1}`} → <span className="font-mono text-indigo-400">{rule.value || '?'}</span>
                    </p>
                  ))}
                  <p className="text-slate-600 mt-0.5">Otherwise → <span className="font-mono text-slate-400">{form.defaultValue}</span> (default)</p>
                </div>
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
            <button type="button" onClick={onClose}
              className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04] transition-smooth">
              Cancel
            </button>
            <button type="submit" disabled={updateMutation.isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/20 transition-smooth">
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {showSaveConfirm && (
          <ConfirmModal
            title="Save Changes"
            message={`Apply changes to "${flag.name}"? This will update the flag across all targeted workloads${rules.length > 0 ? ` with ${rules.length} targeting rule${rules.length > 1 ? 's' : ''}` : ''}.`}
            confirmLabel="Save Changes"
            variant="info"
            onConfirm={() => { setShowSaveConfirm(false); updateMutation.mutate() }}
            onCancel={() => setShowSaveConfirm(false)}
          />
        )}
      </div>
    </div>
  )
}
