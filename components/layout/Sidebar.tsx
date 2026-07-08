'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Tag, Target, Settings, type LucideIcon } from 'lucide-react'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Extrato',       icon: ArrowLeftRight },
  { href: '/categories',   label: 'Categorias',    icon: Tag },
  { href: '/goals',        label: 'Metas',         icon: Target },
  { href: '/settings',     label: 'Configurações', icon: Settings },
]

export function Sidebar({ user: _ }: { user: unknown }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-20 overflow-hidden"
      style={{
        width: open ? '200px' : '64px',
        transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
        background: 'rgba(10,10,18,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Logo */}
      <div
        className="relative flex items-center flex-shrink-0 overflow-hidden"
        style={{ height: '68px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Collapsed: icon only, centered */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo-icon.webp"
          alt="Logo"
          style={{
            height: '26px',
            width: 'auto',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: open ? 0 : 1,
            transition: 'opacity 0.15s',
            pointerEvents: 'none',
          }}
        />
        {/* Expanded: full logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo.png?v=4"
          alt="Logo"
          style={{
            height: '20px',
            width: 'auto',
            position: 'absolute',
            left: '20px',
            opacity: open ? 1 : 0,
            transition: 'opacity 0.18s 0.06s',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Nav — items-center centraliza os quadrados quando colapsado */}
      <nav className="flex flex-col items-center gap-1.5 flex-1 py-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={active}
              open={open}
            />
          )
        })}
      </nav>
    </aside>
  )
}

function NavItem({
  href, label, icon: Icon, active, open,
}: {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
  open: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const bg = active
    ? 'rgba(230,229,216,0.22)'
    : hovered
    ? 'rgba(255,255,255,0.09)'
    : 'rgba(255,255,255,0.03)'

  const border = active
    ? '1px solid rgba(230,229,216,0.4)'
    : hovered
    ? '1px solid rgba(255,255,255,0.12)'
    : '1px solid rgba(255,255,255,0.05)'

  const shadow = active
    ? '0 0 24px rgba(230,229,216,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
    : 'none'

  const color = active ? 'var(--accent)' : hovered ? 'var(--text-1)' : 'var(--text-3)'

  return (
    <Link
      href={href}
      title={!open ? label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center whitespace-nowrap overflow-hidden flex-shrink-0"
      style={{
        /* Colapsado: quadrado 40×40. Expandido: barra larga */
        width: open ? 'calc(100% - 16px)' : '40px',
        height: '40px',
        borderRadius: '12px',
        background: bg,
        border,
        boxShadow: shadow,
        backdropFilter: active ? 'blur(8px)' : 'none',
        WebkitBackdropFilter: active ? 'blur(8px)' : 'none',
        color,
        paddingLeft: open ? '12px' : '0',
        justifyContent: open ? 'flex-start' : 'center',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), background 0.15s, border 0.15s, box-shadow 0.15s, color 0.15s, padding 0.22s',
      }}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />

      {/* Label */}
      <span
        className="text-[13px] font-medium"
        style={{
          marginLeft: open ? '10px' : '0',
          maxWidth: open ? '130px' : '0',
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          whiteSpace: 'nowrap',
          transition: 'max-width 0.22s, opacity 0.16s, margin-left 0.22s',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
    </Link>
  )
}
