'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Tag, Settings } from 'lucide-react'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Extrato',       icon: ArrowLeftRight },
  { href: '/categories',   label: 'Categorias',    icon: Tag },
  { href: '/settings',     label: 'Configurações', icon: Settings },
]

export function Sidebar({ user: _ }: { user: unknown }) {
  const pathname  = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="hidden lg:flex flex-col absolute left-0 top-0 bottom-0 z-20 overflow-hidden"
      style={{
        width: open ? '192px' : '56px',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <nav className="flex flex-col gap-1 w-full py-4 px-2 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={!open ? label : undefined}
              className="relative flex items-center gap-3 h-10 rounded-[12px] transition-all duration-150 px-2.5 whitespace-nowrap overflow-hidden"
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                minWidth: 0,
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'var(--hover)'
                  el.style.color = 'var(--text-2)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'transparent'
                  el.style.color = 'var(--text-3)'
                }
              }}
            >
              {/* Active bar */}
              {active && (
                <span
                  className="absolute -left-2 w-[3px] h-5 rounded-r-full flex-shrink-0"
                  style={{ background: 'var(--accent)' }}
                />
              )}

              {/* Icon — always visible, centered when collapsed */}
              <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                <Icon size={17} />
              </span>

              {/* Label — slides in */}
              <span
                className="text-[12px] font-medium flex-shrink-0"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateX(0)' : 'translateX(-6px)',
                  transition: 'opacity 0.18s, transform 0.18s',
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
