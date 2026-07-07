'use client'

import { useState, useRef, useEffect } from 'react'
import { Users, Check, ChevronDown } from 'lucide-react'

interface ViewOption { key: string; label: string }
interface Props { options: ViewOption[]; activeKey: string; onChange: (key: string) => void }

export function AccountViewSelector({ options, activeKey, onChange }: Props) {
  const currentIndex = options.findIndex((o) => o.key === activeKey)
  const activeLabel  = options[currentIndex]?.label ?? options[0]?.label

  // ── Desktop dropdown ────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function out(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])

  function handleClick() {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const w = 180
    const left = Math.min(rect.left, window.innerWidth - w - 8)
    setDropPos({ top: rect.bottom + 6, left: Math.max(left, 8) })
    setOpen((v) => !v)
  }

  // ── Mobile press-and-drag ───────────────────────────────────────────────────
  const [pressing, setPressing] = useState(false)
  const [hoverIdx, setHoverIdx] = useState(currentIndex)
  const pillRef = useRef<HTMLDivElement>(null)

  function onTouchStart(e: React.TouchEvent) {
    setHoverIdx(currentIndex)
    setPressing(true)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pressing || !pillRef.current) return
    const touch = e.touches[0]
    const children = Array.from(pillRef.current.children) as HTMLElement[]
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect()
      if (touch.clientX >= r.left && touch.clientX <= r.right) {
        setHoverIdx(i)
        break
      }
    }
  }

  function onTouchEnd() {
    if (pressing) onChange(options[hoverIdx].key)
    setPressing(false)
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">

      {/* ── Mobile ── */}
      <div
        className="lg:hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {pressing ? (
          /* Expanded pill — options side by side */
          <div
            ref={pillRef}
            className="flex items-center gap-1 p-1 rounded-full"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-md)',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            {options.map((opt, i) => (
              <div
                key={opt.key}
                className="px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-100"
                style={{
                  background: i === hoverIdx ? 'var(--accent)' : 'transparent',
                  color: i === hoverIdx ? 'var(--accent-text)' : 'var(--text-3)',
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        ) : (
          /* Collapsed — same pill as desktop */
          <button
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-2)',
              border: '1px solid var(--border-md)',
            }}
          >
            <Users size={11} style={{ color: 'var(--text-3)' }} />
            {activeLabel}
            <ChevronDown size={10} style={{ color: 'var(--text-3)' }} />
          </button>
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
        <ChevronDown size={10} style={{
          color: 'var(--text-3)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }} />
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
