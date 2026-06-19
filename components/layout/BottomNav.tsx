'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Tag, Target, TrendingUp, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',    label: 'Dash',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Extrato', icon: ArrowLeftRight },
  { href: '/categories',   label: 'Cats.',   icon: Tag },
  { href: '/goals',        label: 'Metas',   icon: Target },
  { href: '/abc',          label: 'ABC',     icon: TrendingUp },
  { href: '/settings',     label: 'Config',  icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center px-2 pb-safe"
      style={{ background: 'var(--sidebar)', borderTop: '1px solid var(--border)' }}
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors duration-150"
            style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}
          >
            <Icon size={17} />
            <span className="text-[8px] font-semibold uppercase tracking-wider">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
