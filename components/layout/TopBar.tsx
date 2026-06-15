'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOut } from '@/services/authService'
import { useToast } from '@/components/ui/Toast'
import { getInitials } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

export function TopBar({ user }: { user: User | null }) {
  const router  = useRouter()
  const { toast } = useToast()
  const name = user?.user_metadata?.name ?? user?.email ?? ''
  const displayName = name.includes('@') ? name.split('@')[0] : name

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    toast('Sessão encerrada.')
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-11"
      style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center h-full py-2">
        <Image
          src="/logo/Ativo 2.png"
          alt="Logo"
          width={120}
          height={32}
          className="object-contain"
          style={{ height: '22px', width: 'auto' }}
          priority
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        {/* User pill */}
        <div
          className="flex items-center gap-2 px-3 h-7 rounded-[8px]"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0"
            style={{ background: 'var(--accent-dim)', border: '1px solid rgba(124,90,252,0.25)', color: 'var(--accent)' }}
          >
            {getInitials(name)}
          </div>
          <span className="text-[11px] font-medium hidden sm:block" style={{ color: 'var(--text-2)' }}>
            {displayName}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          title="Sair"
          className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-all duration-150"
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
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
