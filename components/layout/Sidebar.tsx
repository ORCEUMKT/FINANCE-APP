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
  const router   = useRouter()
  const { toast } = useToast()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    toast('Sessão encerrada.')
  }

  const name = user?.user_metadata?.name ?? user?.email ?? ''

  return (
    <aside
      className="hidden lg:flex flex-col sticky top-0 h-screen w-56 shrink-0 relative z-10"
      style={{
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5 h-16"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent)', boxShadow: 'var(--glow-accent)' }}
        >
          <TrendingUp size={14} className="text-white" />
        </div>
        <span
          className="text-[13px] font-semibold tracking-[0.04em]"
          style={{ color: 'var(--text-1)' }}
        >
          Finance
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 px-3 py-5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[13px] font-medium transition-all duration-150 group',
              )}
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--text-1)' : 'var(--text-2)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--hover)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Icon
                size={15}
                style={{ color: active ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div
        className="px-3 py-4 flex flex-col gap-0.5"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid rgba(91,138,245,0.2)',
              color: 'var(--accent)',
            }}
          >
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{name}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[13px] font-medium transition-all duration-150"
          style={{ color: 'var(--text-2)' }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(244,115,115,0.06)'
            el.style.color = '#f47373'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.color = 'var(--text-2)'
          }}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          Sair
        </button>
      </div>
    </aside>
  )
}
