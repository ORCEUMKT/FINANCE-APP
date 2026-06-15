'use client'

import type { User } from '@supabase/supabase-js'

export function TopBar({ user: _ }: { user: User | null }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex lg:hidden items-center justify-center h-11"
      style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo/logo.png?v=2"
        alt="Logo"
        style={{ height: '20px', width: 'auto', objectFit: 'contain' }}
      />
    </header>
  )
}
