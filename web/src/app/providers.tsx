'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchInterval: 10 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>{children}</AuthGuard>
    </QueryClientProvider>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!token && pathname !== '/login') {
      router.replace('/login')
    } else if (token && pathname === '/login') {
      router.replace('/')
    } else {
      setReady(true)
    }
  }, [token, pathname, router])

  if (!ready) return null

  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto grid-bg">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
