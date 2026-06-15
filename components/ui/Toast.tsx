'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error'
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  toast: (message: string, options?: { type?: ToastItem['type']; action?: ToastItem['action'] }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, options?: { type?: ToastItem['type']; action?: ToastItem['action'] }) => {
    const id = crypto.randomUUID()
    const item: ToastItem = { id, message, type: options?.type ?? 'success', action: options?.action }
    setToasts((prev) => [...prev, item])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold',
              'bg-[rgba(24,26,30,.95)] border border-white/[.14] shadow-[0_16px_48px_rgba(0,0,0,.5)]',
              'backdrop-blur-xl whitespace-nowrap'
            )}
          >
            {t.type === 'success'
              ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
              : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
            <span className="text-white/90">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                className="text-emerald-400 font-bold text-xs underline ml-1"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="text-white/30 hover:text-white/70 ml-1 transition-colors">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
