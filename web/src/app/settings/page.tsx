'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clustersApi, usersApi } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { Settings, Globe, Shield, Bell, Database, Code, Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
  const { data: clusters } = useQuery({ queryKey: ['clusters'], queryFn: () => clustersApi.list() })
  const [activeTab, setActiveTab] = useState('general')

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'auth', label: 'Authentication', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API & SDKs', icon: Code },
    { id: 'database', label: 'Database', icon: Database },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Configure your Vexil platform</p>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-48 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth ${
                activeTab === tab.id
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 glass rounded-xl p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Platform Info</h3>
                <div className="space-y-3">
                  <SettingRow label="Version" value="0.1.0" />
                  <SettingRow label="Connected Clusters" value={String(clusters?.length || 0)} />
                  <SettingRow label="Default Namespace" value="default" />
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-6">
                <h3 className="text-sm font-semibold text-white mb-4">Flag Defaults</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Default Delivery Method</label>
                    <select className="w-full max-w-xs rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm">
                      <option>Environment Variable</option>
                      <option>ConfigMap</option>
                      <option>Sidecar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Auto-archive inactive flags after</label>
                    <select className="w-full max-w-xs rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm">
                      <option>Never</option>
                      <option>30 days</option>
                      <option>60 days</option>
                      <option>90 days</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'auth' && <UsersPanel />}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-white mb-4">Notifications</h3>
              <div className="space-y-4">
                <ToggleSetting label="Flag changes" description="Notify when a flag is created, updated or deleted" defaultChecked />
                <ToggleSetting label="Cluster events" description="Notify on cluster connect/disconnect" defaultChecked />
                <ToggleSetting label="Rollout progress" description="Notify on rollout step changes" />
                <ToggleSetting label="Policy violations" description="Notify when a flag violates a policy" defaultChecked />
              </div>
              <div className="border-t border-white/[0.06] pt-6">
                <h3 className="text-sm font-semibold text-white mb-4">Webhook URL</h3>
                <input type="text" placeholder="https://hooks.slack.com/services/..."
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm" />
                <p className="text-xs text-slate-500 mt-1.5">Events will be sent as JSON POST requests</p>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-white mb-4">API & SDK Integration</h3>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">API Server URL</label>
                <div className="flex gap-2">
                  <input type="text" value={typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1'} readOnly
                    className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm font-mono" />
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-6">
                <h3 className="text-sm font-semibold text-white mb-3">SDK Quick Start</h3>
                <div className="space-y-3">
                  <CodeBlock lang="Go" code={`client, _ := vexil.New(vexil.WithEnvProvider())
darkMode := client.Bool("dark-mode", false)`} />
                  <CodeBlock lang="Python" code={`from vexil import Client
client = Client(provider="env")
dark_mode = client.bool("dark-mode", default=False)`} />
                  <CodeBlock lang="Node.js" code={`import { Client } from 'vexil';
const client = new Client({ provider: 'env' });
const darkMode = await client.bool('dark-mode', false);`} />
                  <CodeBlock lang="C# / .NET" code={`using var client = new VexilClient(new EnvProvider());
var darkMode = client.Bool("dark-mode", false);
var rateLimit = client.Int("api-rate-limit", 100);`} />
                  <CodeBlock lang="C# / ASP.NET Core DI" code={`// Program.cs
builder.Services.AddVexilEnv();          // env vars
builder.Services.AddVexilSidecar();      // sidecar
builder.Services.AddVexilConfigMap();    // configmap

// En tu controller o service:
public class MyService(VexilClient vexil)
{
    public void DoWork()
    {
        if (vexil.Bool("dark-mode"))
            EnableDarkMode();
    }
}`} />
                  <CodeBlock lang="curl" code={`# Direct sidecar API
curl localhost:8514/flags/dark-mode/value
# -> true

# SSE streaming (real-time)
curl localhost:8514/flags/stream`} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-white mb-4">Database</h3>
              <div className="space-y-3">
                <SettingRow label="Type" value="PostgreSQL 16" />
                <SettingRow label="Status" value="Connected" valueClass="text-emerald-400" />
                <SettingRow label="Storage" value="Audit logs, sessions, cluster cache" />
              </div>
              <div className="border-t border-white/[0.06] pt-6">
                <p className="text-xs text-slate-500">Feature flags are stored as Kubernetes CRDs, not in the database. The database is used for portal-specific data only.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Users Panel ────────────────────────────────────────────────────────────────

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  editor: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  viewer: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
}

function UsersPanel() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)

  // Create form state
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('viewer')

  // Edit form state
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editOriginalRole, setEditOriginalRole] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      setNewUsername('')
      setNewPassword('')
      setNewRole('viewer')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ username, data }: { username: string; data: { password?: string; role?: string } }) =>
      usersApi.update(username, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
      setEditPassword('')
      setEditRole('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeletingUser(null)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({ username: newUsername, password: newPassword, role: newRole })
  }

  const handleUpdate = (username: string) => {
    const data: { password?: string; role?: string } = {}
    if (editPassword) data.password = editPassword
    if (editRole && editRole !== '' && editRole !== editOriginalRole) data.role = editRole
    if (Object.keys(data).length > 0) {
      updateMutation.mutate({ username, data })
    }
  }

  const startEditing = (user: { username: string; role: string }) => {
    setEditingUser(user.username)
    setEditPassword('')
    setEditRole(user.role)
    setEditOriginalRole(user.role)
  }

  const inputClass = 'w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-smooth'
  const selectClass = 'rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-smooth'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">User Management</h3>
        {isAdmin && (
          <button
            onClick={() => { setShowCreate(!showCreate); createMutation.reset() }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-smooth ${
              showCreate
                ? 'bg-slate-700/50 text-slate-300'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showCreate ? 'Cancel' : 'New user'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-lg border border-indigo-500/10 bg-indigo-500/[0.03] p-4 space-y-3">
          <p className="text-xs font-medium text-indigo-400 mb-3">Create new user</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="username"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="password"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className={`w-full ${selectClass}`}
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          {createMutation.isError && (
            <p className="text-xs text-rose-400">{(createMutation.error as Error).message}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-smooth"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Create user
            </button>
          </div>
        </form>
      )}

      {/* Users list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      ) : users && users.length > 0 ? (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_1fr_100px] gap-4 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Username</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Role</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Created</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Actions</span>
          </div>

          {/* Rows */}
          {users.map((u) => (
            <div key={u.username}>
              <div className="grid grid-cols-[1fr_100px_1fr_100px] gap-4 items-center px-4 py-3 border-b border-white/[0.04] last:border-0">
                <span className="text-sm text-slate-200 font-medium">{u.username}</span>
                <span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${roleBadgeColors[u.role] || roleBadgeColors.viewer}`}>
                    {u.role}
                  </span>
                </span>
                <span className="text-sm text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center justify-end gap-1">
                  {isAdmin && (
                    <button
                      onClick={() => editingUser === u.username ? setEditingUser(null) : startEditing(u)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-smooth"
                      title="Edit user"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!isAdmin && u.username === currentUser?.username && (
                    <button
                      onClick={() => editingUser === u.username ? setEditingUser(null) : startEditing(u)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-smooth"
                      title="Change password"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isAdmin && u.username !== currentUser?.username && (
                    <button
                      onClick={() => setDeletingUser(u.username)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-smooth"
                      title="Delete user"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Edit form (inline) */}
              {editingUser === u.username && (
                <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">New password</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Leave empty to keep current"
                        className={inputClass}
                      />
                    </div>
                    {isAdmin && (
                      <div className="w-36">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className={`w-full ${selectClass}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </div>
                    )}
                    <button
                      onClick={() => handleUpdate(u.username)}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-smooth"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => setEditingUser(null)}
                      className="rounded-lg border border-white/[0.06] px-3 py-2.5 text-xs font-medium text-slate-400 hover:bg-white/[0.04] transition-smooth"
                    >
                      Cancel
                    </button>
                  </div>
                  {updateMutation.isError && (
                    <p className="text-xs text-rose-400 mt-2">{(updateMutation.error as Error).message}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Shield className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">No users found</p>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingUser && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-4">
          <p className="text-sm text-slate-200">
            Delete user <span className="font-semibold text-white">{deletingUser}</span>? This action cannot be undone.
          </p>
          {deleteMutation.isError && (
            <p className="text-xs text-rose-400 mt-2">{(deleteMutation.error as Error).message}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => deleteMutation.mutate(deletingUser)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50 transition-smooth"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>
            <button
              onClick={() => { setDeletingUser(null); deleteMutation.reset() }}
              className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/[0.04] transition-smooth"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared Components ──────────────────────────────────────────────────────────

function SettingRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-medium ${valueClass || 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

function ToggleSetting({ label, description, defaultChecked }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked || false)
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-slate-200">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative h-6 w-11 rounded-full transition-smooth ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-smooth ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-slate-900/50 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <span className="text-[10px] font-semibold text-slate-500">{lang}</span>
      </div>
      <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto"><code>{code}</code></pre>
    </div>
  )
}
