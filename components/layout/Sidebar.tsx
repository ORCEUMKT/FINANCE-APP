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
    <aside className="hidden lg:flex flex-col sticky top-0 h-screen w-56 shrink-0 bg-[#0f1114] border-r border-[#1e2226]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-[#1e2226]">
        <div className="w-7 h-7 rounded-lg bg-[#00d4a0] flex items-center justify-center flex-shrink-0">
          <TrendingUp size={14} className="text-[#0c0e10]" />
        </div>
        <span className="text-sm font-bold tracking-widest text-white uppercase">Finance</span>
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150',
                active
                  ? 'bg-[#1a1d22] text-white'
                  : 'text-[#6b7280] hover:text-[#c4c9d0] hover:bg-[#13161a]'
              )}
            >
              <Icon size={16} className={active ? 'text-[#00d4a0]' : ''} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-[#1e2226] px-3 py-4 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-[#1a1d22] border border-[#2a2f36] flex items-center justify-center text-[10px] font-bold text-[#00d4a0] flex-shrink-0">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{name}</p>
            <p className="text-[10px] text-[#6b7280] truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-[#6b7280] hover:text-red-400 hover:bg-red-500/[.06] transition-all"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
