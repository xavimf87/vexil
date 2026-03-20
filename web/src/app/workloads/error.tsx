'use client'

import { AlertCircle } from 'lucide-react'

export default function WorkloadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8">
      <div className="glass rounded-xl p-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Something went wrong</h3>
        <p className="mt-1 text-xs text-slate-500">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-smooth"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
