'use client'

import { useState, useRef, useEffect } from 'react'
import { Users, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const currentIndex = options.findIndex((o) => o.key === activeKey)

  // ── Desktop dropdown ────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const activeLabel = options[currentIndex]?.label ?? options[0]?.label

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleClick() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const dropWidth = 180
      const left = Math.min(rect.left, window.innerWidth - dropWidth - 8)
      setDropPos({ top: rect.bottom + 6, left: Math.max(left, 8) })
    }
    setOpen((v) => !v)
  }

  // ── Mobile swipe ────────────────────────────────────────────────────────────
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [dragDelta, setDragDelta] = useState(0)
  const THRESHOLD = 40

  function onTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
    setDragDelta(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX === null) return
    setDragDelta(e.touches[0].clientX - touchStartX)
  }

  function onTouchEnd() {
    if (touchStartX === null) return
    if (dragDelta < -THRESHOLD && currentIndex < options.length - 1) {
      onChange(options[currentIndex + 1].key)
    } else if (dragDelta > THRESHOLD && currentIndex > 0) {
      onChange(options[currentIndex - 1].key)
    }
    setTouchStartX(null)
    setDragDelta(0)
  }

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < options.length - 1

  // Clamp visual drag so it doesn't slide too far
  const clampedDrag = Math.max(-32, Math.min(32, dragDelta))

  return (
    <div ref={ref} className="relative flex-shrink-0">

      {/* ── Mobile swipe button ── */}
      <div
        className="lg:hidden select-none touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-md)',
            transform: `translateX(${clampedDrag}px)`,
            transition: touchStartX !== null ? 'none' : 'transform 0.2s ease',
          }}
        >
          <Users size={11} style={{ color: 'var(--text-3)' }} />

          {/* Prev arrow */}
          <ChevronLeft
            size={12}
            style={{ color: hasPrev ? 'var(--text-3)' : 'transparent', flexShrink: 0 }}
          />

          {/* Label */}
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-2)', minWidth: 80, textAlign: 'center' }}>
            {activeLabel}
          </span>

          {/* Next arrow */}
          <ChevronRight
            size={12}
            style={{ color: hasNext ? 'var(--text-3)' : 'transparent', flexShrink: 0 }}
          />
        </div>

        {/* Dot indicators */}
        {options.length > 1 && (
          <div className="flex justify-center gap-1 mt-1">
            {options.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === currentIndex ? 14 : 4,
                  height: 4,
                  background: i === currentIndex ? 'var(--accent)' : 'var(--border-md)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop dropdown button ── */}
      <button
        onClick={handleClick}
        className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
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

      {/* Desktop dropdown menu */}
      {open && (
        <div
          className="fixed min-w-[180px] rounded-2xl overflow-hidden z-[999]"
          style={{
            top: dropPos.top,
            left: dropPos.left,
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
