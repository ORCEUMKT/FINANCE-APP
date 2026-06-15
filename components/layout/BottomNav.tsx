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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center px-2 pb-safe bg-[#0f1114] border-t border-[#1e2226]">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 transition-colors duration-150',
              active ? 'text-[#00d4a0]' : 'text-[#6b7280] hover:text-[#c4c9d0]'
            )}
          >
            <Icon size={19} />
            <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
