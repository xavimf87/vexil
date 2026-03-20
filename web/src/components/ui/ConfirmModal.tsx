'use client'

import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const colors = {
    danger: {
      icon: 'bg-red-500/10 text-red-400',
      button: 'bg-red-600 hover:bg-red-500 shadow-red-600/20',
    },
    warning: {
      icon: 'bg-amber-500/10 text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20',
    },
    info: {
      icon: 'bg-indigo-500/10 text-indigo-400',
      button: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20',
    },
  }

  const style = colors[variant]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl glass p-6 shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className={`rounded-xl p-2.5 ${style.icon}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{message}</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white transition-smooth">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/[0.06] px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.04] transition-smooth"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg transition-smooth ${style.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
