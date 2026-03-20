'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Flag, Server, Boxes, ScrollText, Settings, LayoutDashboard, Search, X, LogOut } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { authApi } from '@/lib/api-client'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, keywords: ['home', 'overview'] },
  { name: 'Feature Flags', href: '/flags', icon: Flag, keywords: ['toggle', 'flag', 'feature'] },
  { name: 'Clusters', href: '/clusters', icon: Server, keywords: ['cluster', 'node', 'kubernetes'] },
  { name: 'Workloads', href: '/workloads', icon: Boxes, keywords: ['deployment', 'pod', 'workload', 'app'] },
  { name: 'Audit Log', href: '/audit', icon: ScrollText, keywords: ['audit', 'log', 'history', 'event'] },
  { name: 'Settings', href: '/settings', icon: Settings, keywords: ['settings', 'config', 'preferences'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, token, logout } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleLogout() {
    if (token) {
      await authApi.logout(token)
    }
    logout()
    router.replace('/login')
  }

  const filtered = navigation.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q))
  })

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearch('')
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => {
          if (prev) {
            setSearch('')
            return false
          }
          return true
        })
      }
      if (e.key === 'Escape' && searchOpen) {
        closeSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen, closeSearch])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  function handleSelect(href: string) {
    router.push(href)
    closeSearch()
  }

  return (
    <>
      <aside className="flex w-[260px] flex-col border-r border-white/[0.06] bg-slate-950">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/20">
            <Flag className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white">Vexil</span>
            <span className="ml-1.5 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">BETA</span>
          </div>
        </div>

        {/* Search trigger */}
        <div className="px-4 mb-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-slate-500 hover:bg-white/[0.05] hover:border-white/[0.1] transition-smooth"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">Ctrl+K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Platform</p>
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth',
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400 shadow-sm shadow-indigo-500/5'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                )}
              >
                <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-indigo-400')} />
                {item.name}
                {item.name === 'Feature Flags' && (
                  <span className="ml-auto rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                    FF
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white uppercase">
              {user?.username?.charAt(0) || 'V'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{user?.username || 'Unknown'}</p>
              <p className="text-[10px] text-slate-500">{user?.role || 'user'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.05] hover:text-slate-300 transition-smooth"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Command palette modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={closeSearch}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md rounded-xl border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtered.length > 0) {
                    handleSelect(filtered[0].href)
                  }
                }}
                placeholder="Search pages..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              <button onClick={closeSearch} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">No results</p>
              ) : (
                filtered.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleSelect(item.href)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-smooth',
                        isActive
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-slate-300 hover:bg-white/[0.05]'
                      )}
                    >
                      <item.icon className="h-4 w-4 text-slate-500" />
                      {item.name}
                    </button>
                  )
                })
              )}
            </div>
            <div className="border-t border-white/[0.06] px-4 py-2 flex items-center gap-3 text-[10px] text-slate-500">
              <span><kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono">Enter</kbd> to select</span>
              <span><kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
