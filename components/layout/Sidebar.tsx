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
    <aside className="hidden lg:flex flex-col sticky top-5 h-[calc(100vh-40px)] w-64 shrink-0">
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white/[.065] to-white/[.018] border border-white/[.09] rounded-3xl p-5 shadow-[0_36px_90px_rgba(0,0,0,.5)] backdrop-blur-2xl overflow-hidden">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 px-1">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-[#050506]" />
          </div>
          <span className="text-sm font-900 tracking-widest text-white uppercase">Finance</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-[12px] font-700 transition-all duration-200',
                  active
                    ? 'bg-white/[.1] text-white border border-white/[.12]'
                    : 'text-white/45 hover:text-white hover:bg-white/[.06]'
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/[.07] pt-4 mt-2">
          <div className="flex items-center gap-3 px-1 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/[.1] border border-white/[.12] flex items-center justify-center text-[10px] font-900 text-white flex-shrink-0">
              {getInitials(name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-700 text-white truncate">{name}</p>
              <p className="text-[10px] text-white/35 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[11px] font-700 text-white/35 hover:text-red-400 hover:bg-red-500/[.06] transition-all"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}
