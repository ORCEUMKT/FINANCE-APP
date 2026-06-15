'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Tag, Settings, LogOut, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/services/authService'
import { useToast } from '@/components/ui/Toast'
import { getInitials } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Extrato',       icon: ArrowLeftRight },
  { href: '/categories',   label: 'Categorias',    icon: Tag },
  { href: '/settings',     label: 'Configurações', icon: Settings },
]

export function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    toast('Sessão encerrada.')
  }

  const name = user?.user_metadata?.name ?? user?.email ?? ''

  return (
    <aside className="hidden lg:flex flex-col sticky top-0 h-screen w-56 shrink-0 bg-[#141729] border-r border-[#2a2f4a]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-[#2a2f4a]">
        <div className="w-7 h-7 rounded-lg bg-[#5b8af5] flex items-center justify-center flex-shrink-0">
          <TrendingUp size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">Finance</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 px-3 py-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150',
                active
                  ? 'bg-[#5b8af5]/15 text-white'
                  : 'text-[#8b92b5] hover:text-[#c5c8e0] hover:bg-[#1e2235]'
              )}
            >
              <Icon size={16} className={active ? 'text-[#5b8af5]' : ''} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-[#2a2f4a] px-3 py-4 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-[#5b8af5]/20 border border-[#5b8af5]/30 flex items-center justify-center text-[10px] font-bold text-[#5b8af5] flex-shrink-0">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{name}</p>
            <p className="text-[10px] text-[#8b92b5] truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#8b92b5] hover:text-red-400 hover:bg-red-500/[.08] transition-all"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
