'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Tag, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',    label: 'Dash',      icon: LayoutDashboard },
  { href: '/transactions', label: 'Extrato',    icon: ArrowLeftRight },
  { href: '/categories',   label: 'Categorias', icon: Tag },
  { href: '/settings',     label: 'Config',     icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center px-2 pb-safe bg-[rgba(12,13,15,.85)] border-t border-white/[.08] backdrop-blur-2xl">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 transition-colors duration-200',
              active ? 'text-white' : 'text-white/35 hover:text-white/60'
            )}
          >
            <Icon size={19} />
            <span className="text-[9px] font-800 uppercase tracking-wide">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
