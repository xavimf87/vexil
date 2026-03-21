'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flagsApi, clustersApi } from '@/lib/api-client'
import { X, ChevronRight, ChevronLeft, Check, Copy, Info } from 'lucide-react'
import type { FlagType } from '@/lib/types'

interface CreateFlagModalProps {
  onClose: () => void
}

async function fetchNamespaces(clusterId: string): Promise<string[]> {
  const res = await fetch(`/api/v1/clusters/${clusterId}/namespaces`)
  if (!res.ok) return ['default']
  const data = await res.json()
  return data.length > 0 ? data : ['default']
}

export function CreateFlagModal({ onClose }: CreateFlagModalProps) {
  const queryClient = useQueryClient()
  const { data: clusters = [] } = useQuery({ queryKey: ['clusters'], queryFn: () => clustersApi.list() })

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    namespace: 'default',
    clusterId: '',
    type: 'boolean' as FlagType,
    defaultValue: 'false',
    description: '',
    deliveryMethod: 'envVar' as 'envVar' | 'configMap' | 'sidecar',
    envVarName: '',
    selectorLabels: '',
    configMapName: '',
    configMapKey: '',
  })

  // Auto-select cluster if only one
  useEffect(() => {
    if (clusters.length === 1 && !form.clusterId) {
      setForm((f) => ({ ...f, clusterId: clusters[0].id }))
    }
  }, [clusters, form.clusterId])

  // Fetch namespaces for selected cluster
  const { data: namespaces = ['default'] } = useQuery({
    queryKey: ['namespaces', form.clusterId],
    queryFn: () => fetchNamespaces(form.clusterId),
    enabled: !!form.clusterId,
  })

  // Computed env var name
  const computedEnvVar = useMemo(
    () => form.envVarName || `FLAG_${form.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
    [form.envVarName, form.name]
  )

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
      } else if (form.deliveryMethod === 'sidecar' && form.selectorLabels) {
        const labels = Object.fromEntries(
          form.selectorLabels.split(',').map((l) => l.trim().split('='))
        )
        delivery.sidecar = {
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
        delivery: Object.keys(delivery).length > 0 ? delivery as any : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags'] })
      setStep(4) // Go to success step
    },
  })

  const canProceedStep1 = form.name && form.namespace && form.clusterId
  const canProceedStep2 = form.deliveryMethod === 'sidecar'
    ? !!form.selectorLabels
    : form.deliveryMethod === 'envVar'
      ? !!form.selectorLabels
      : form.deliveryMethod === 'configMap'
        ? !!form.configMapName && !!form.selectorLabels
        : true

  const inputClass = 'w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-smooth'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-xl glass p-6 shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {step === 4 ? 'Flag Created' : 'New Feature Flag'}
            </h2>
            {step < 4 && (
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-6 bg-indigo-500' : s < step ? 'w-1.5 bg-indigo-400' : 'w-1.5 bg-slate-700'
                    }`} />
                  </div>
                ))}
                <span className="text-[10px] text-slate-500 ml-1">
                  {step === 1 ? 'Define' : step === 2 ? 'Deliver' : 'Review'}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Define the flag */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">A feature flag controls a behavior in your application. Define what it is and where it lives.</p>

            {/* Cluster */}
            {clusters.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cluster</label>
                <select value={form.clusterId} onChange={(e) => setForm({ ...form, clusterId: e.target.value })} className={inputClass} required>
                  <option value="">Select cluster...</option>
                  {clusters.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Flag name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder="dark-mode"
                className={inputClass}
                required
              />
              <p className="text-[10px] text-slate-600 mt-1">Lowercase, hyphens allowed. This becomes a Kubernetes CRD resource.</p>
            </div>

            {/* Namespace */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Namespace</label>
              <select value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} className={inputClass}>
                {namespaces.map((ns) => <option key={ns} value={ns}>{ns}</option>)}
              </select>
              <p className="text-[10px] text-slate-600 mt-1">The flag will only target workloads in this namespace.</p>
            </div>

            {/* Type + Value */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => {
                    const type = e.target.value as FlagType
                    const defaults: Record<FlagType, string> = { boolean: 'false', string: '', integer: '0', json: '{}' }
                    setForm({ ...form, type, defaultValue: defaults[type] })
                  }}
                  className={inputClass}
                >
                  <option value="boolean">Boolean (on/off)</option>
                  <option value="string">String</option>
                  <option value="integer">Integer</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Initial value</label>
                {form.type === 'boolean' ? (
                  <select value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} className={inputClass}>
                    <option value="false">false (off)</option>
                    <option value="true">true (on)</option>
                  </select>
                ) : (
                  <input type="text" value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} className={`${inputClass} font-mono`} />
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Description <span className="text-slate-600">(optional)</span></label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Enable the new checkout flow for selected users"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Step 2: How to deliver */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">How should your application receive this flag? Vexil injects the value automatically into your pods.</p>

            {/* Delivery Method */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Delivery method</label>
              {[
                { id: 'envVar', label: 'Environment Variable', desc: `Injects ${computedEnvVar}=${form.defaultValue} into matching pods. Simplest option.` },
                { id: 'configMap', label: 'ConfigMap', desc: 'Writes the flag value to a ConfigMap key. Good for config files or shared flags.' },
                { id: 'sidecar', label: 'Sidecar API', desc: 'Exposes flags via HTTP on port 8514 with real-time SSE streaming. Best for dynamic flags.' },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setForm({ ...form, deliveryMethod: method.id as any })}
                  className={`w-full text-left rounded-lg border p-3 transition-smooth ${
                    form.deliveryMethod === method.id
                      ? 'border-indigo-500/40 bg-indigo-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}
                >
                  <p className={`text-sm font-medium ${form.deliveryMethod === method.id ? 'text-indigo-400' : 'text-slate-300'}`}>{method.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{method.desc}</p>
                </button>
              ))}
            </div>

            {/* Target selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target workloads by labels</label>
              <input
                type="text"
                value={form.selectorLabels}
                onChange={(e) => setForm({ ...form, selectorLabels: e.target.value })}
                placeholder="app=frontend"
                className={inputClass}
              />
              <p className="text-[10px] text-slate-600 mt-1">
                Comma-separated key=value pairs. Only Deployments/StatefulSets/DaemonSets with <strong>all</strong> these labels in namespace <strong>{form.namespace}</strong> will receive the flag.
              </p>
            </div>

            {/* Env var name override */}
            {form.deliveryMethod === 'envVar' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Env var name <span className="text-slate-600">(auto-generated if empty)</span>
                </label>
                <input
                  type="text"
                  value={form.envVarName}
                  onChange={(e) => setForm({ ...form, envVarName: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                  placeholder={computedEnvVar}
                  className={`${inputClass} font-mono`}
                />
              </div>
            )}

            {/* ConfigMap fields */}
            {form.deliveryMethod === 'configMap' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">ConfigMap name</label>
                  <input type="text" value={form.configMapName} onChange={(e) => setForm({ ...form, configMapName: e.target.value })} placeholder="vexil-flags" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Key</label>
                  <input type="text" value={form.configMapKey} onChange={(e) => setForm({ ...form, configMapKey: e.target.value })} placeholder={form.name || 'flag-key'} className={inputClass} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Review your flag before creating it. This will create a FeatureFlag CRD in your cluster.</p>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">Name</span>
                <span className="text-slate-200 font-mono">{form.name}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">Namespace</span>
                <span className="text-slate-200">{form.namespace}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">Type</span>
                <span className="text-slate-200">{form.type}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">Initial value</span>
                <span className="text-slate-200 font-mono">{form.defaultValue}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">Delivery</span>
                <span className="text-slate-200">
                  {form.deliveryMethod === 'envVar' ? `Env var: ${computedEnvVar}` :
                   form.deliveryMethod === 'configMap' ? `ConfigMap: ${form.configMapName}/${form.configMapKey || form.name}` :
                   'Sidecar API (port 8514)'}
                </span>
              </div>
              {form.selectorLabels && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-500">Targets</span>
                  <span className="text-slate-200 font-mono text-xs">{form.selectorLabels}</span>
                </div>
              )}
              {form.description && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-500">Description</span>
                  <span className="text-slate-300 text-xs">{form.description}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-400">
                  <p className="text-amber-400 font-medium mb-1">What happens next?</p>
                  <p>The operator will find workloads with labels <span className="font-mono text-slate-300">{form.selectorLabels || '(none)'}</span> and inject the flag value. Affected pods will restart to pick up the new env var.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success + Next Steps */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-400">Flag created successfully</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  <span className="font-mono">{form.name}</span> is now active in <span className="font-mono">{form.namespace}</span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Read the flag in your application</h3>
              <div className="space-y-2.5">
                {form.deliveryMethod === 'envVar' && (
                  <>
                    <CodeSnippet lang="Go" code={`darkMode := os.Getenv("${computedEnvVar}") == "true"`} />
                    <CodeSnippet lang="Python" code={`dark_mode = os.environ.get("${computedEnvVar}", "false") == "true"`} />
                    <CodeSnippet lang="Node.js" code={`const darkMode = process.env.${computedEnvVar} === "true";`} />
                    <CodeSnippet lang="C#" code={`var darkMode = Environment.GetEnvironmentVariable("${computedEnvVar}") == "true";`} />
                  </>
                )}
                {form.deliveryMethod === 'configMap' && (
                  <>
                    <CodeSnippet lang="Mount in pod" code={`# In your Deployment spec:\nvolumes:\n  - name: flags\n    configMap:\n      name: ${form.configMapName}\ncontainers:\n  - volumeMounts:\n      - name: flags\n        mountPath: /etc/flags`} />
                    <CodeSnippet lang="Read as env" code={`# Or reference in env:\nenv:\n  - name: ${computedEnvVar}\n    valueFrom:\n      configMapKeyRef:\n        name: ${form.configMapName}\n        key: ${form.configMapKey || form.name}`} />
                  </>
                )}
                {form.deliveryMethod === 'sidecar' && (
                  <>
                    <CodeSnippet lang="HTTP" code={`curl localhost:8514/flags/${form.name}/value\n# -> ${form.defaultValue}`} />
                    <CodeSnippet lang="SSE stream" code={`curl localhost:8514/flags/stream\n# Real-time updates via Server-Sent Events`} />
                  </>
                )}
              </div>
            </div>

            {form.deliveryMethod === 'envVar' && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-xs text-slate-500">
                  Or use a <strong className="text-slate-300">Vexil SDK</strong> for type-safe access with defaults:
                </p>
                <div className="mt-2 bg-slate-900/80 rounded-md px-3 py-2 text-xs font-mono text-slate-300 overflow-x-auto">
                  {`client, _ := vexil.New(vexil.WithEnvProvider())\ndarkMode := client.Bool("${form.name}", false)`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {createMutation.isError && (
          <p className="mt-3 text-sm text-red-400">
            {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create flag'}
          </p>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step === 4 ? (
            <div className="flex w-full justify-end">
              <button onClick={onClose} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20">
                Done
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04] transition-smooth"
              >
                {step > 1 ? <><ChevronLeft className="h-4 w-4" /> Back</> : 'Cancel'}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 shadow-lg shadow-indigo-600/20 transition-smooth"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Flag'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CodeSnippet({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-lg border border-white/[0.06] bg-slate-900/50 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1">
        <span className="text-[10px] font-semibold text-slate-500">{lang}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="text-slate-600 hover:text-slate-400 transition-smooth"
          title="Copy"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="p-2.5 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap"><code>{code}</code></pre>
    </div>
  )
}
