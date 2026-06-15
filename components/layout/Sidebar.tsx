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
      className="hidden lg:flex flex-col sticky top-0 h-screen w-14 shrink-0 items-center relative z-10"
      style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand icon */}
      <div
        className="w-full flex items-center justify-center h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center"
          style={{ background: 'var(--accent)', boxShadow: 'var(--glow-accent)' }}
        >
          <TrendingUp size={15} className="text-white" />
        </div>
      </div>

      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-1 flex-1 w-full py-4 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'relative w-10 h-10 rounded-[12px] flex items-center justify-center transition-all duration-150 group'
              )}
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-3)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--hover)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-2)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-3)'
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

      {/* User avatar + logout */}
      <div
        className="flex flex-col items-center gap-2 w-full px-2 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid rgba(124,90,252,0.2)',
            color: 'var(--accent)',
          }}
          title={name}
        >
          {getInitials(name)}
        </div>
        <button
          onClick={handleSignOut}
          title="Sair"
          className="w-10 h-10 rounded-[12px] flex items-center justify-center transition-all duration-150"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(248,113,113,0.07)'
            el.style.color = '#f87171'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.color = 'var(--text-3)'
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )
}
