'use client'

import { useState, useRef, useEffect } from 'react'
import { Users, Check, ChevronDown } from 'lucide-react'

interface ViewOption {
  key: string
  label: string
}

interface Props {
  options: ViewOption[]
  activeKey: string
  onChange: (key: string) => void
}

export function AccountViewSelector({ options, activeKey, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'left' | 'right'>('left')
  const ref = useRef<HTMLDivElement>(null)

  const activeLabel = options.find((o) => o.key === activeKey)?.label ?? options[0]?.label

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleToggle() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      // Open to the right if there's room (≥160px), otherwise open to the left
      setSide(window.innerWidth - rect.right >= 160 ? 'left' : 'right')
    }
    setOpen((v) => !v)
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
        style={{
          background: 'var(--surface)',
          color: 'var(--text-2)',
          border: '1px solid var(--border-md)',
        }}
      >
        <Users size={11} style={{ color: 'var(--text-3)' }} />
        {activeLabel}
        <ChevronDown
          size={10}
          style={{
            color: 'var(--text-3)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 min-w-[160px] rounded-2xl overflow-hidden z-50"
          style={{
            [side === 'left' ? 'left' : 'right']: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border-md)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] transition-colors text-left hover:opacity-80"
              style={{
                color: activeKey === opt.key ? 'var(--accent)' : 'var(--text-2)',
                background: activeKey === opt.key ? 'var(--accent-dim)' : 'transparent',
              }}
            >
              {opt.label}
              {activeKey === opt.key && <Check size={11} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
