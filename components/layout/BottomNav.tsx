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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center px-2 pb-safe bg-[#141729] border-t border-[#2a2f4a]">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 transition-colors duration-150',
              active ? 'text-[#5b8af5]' : 'text-[#8b92b5] hover:text-[#c5c8e0]'
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
