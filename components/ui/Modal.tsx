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
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pt-[58px] pb-[76px] sm:p-4"
      style={{ background: 'rgba(5,5,10,0.8)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={cn('w-full sm:max-w-lg rounded-[20px] max-h-full overflow-y-auto p-5 sm:p-6', className)}
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-md)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors duration-150"
              style={{ background: 'var(--hover)', color: 'var(--text-2)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}
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
