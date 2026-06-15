'use client'

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
  const pathname = usePathname()

  return (
    <aside
      className="hidden lg:flex flex-col sticky top-11 h-[calc(100vh-2.75rem)] w-14 shrink-0 items-center relative z-10"
      style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}
    >
      <nav className="flex flex-col items-center gap-1 w-full py-4 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className="relative w-10 h-10 rounded-[12px] flex items-center justify-center transition-all duration-150"
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-3)',
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
              {active && (
                <span
                  className="absolute -left-2 w-[3px] h-5 rounded-r-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon size={17} />
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
