'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={cn(
          'w-full sm:max-w-lg bg-gradient-to-br from-[#1c1d21] to-[#0a0b0c]',
          'border border-white/[.14] rounded-t-3xl sm:rounded-2xl',
          'max-h-[92vh] overflow-y-auto shadow-[0_36px_90px_rgba(0,0,0,.6)]',
          'p-6',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl border border-white/10 bg-white/[.04] text-white/50 hover:text-white hover:bg-white/[.08] transition-all flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
