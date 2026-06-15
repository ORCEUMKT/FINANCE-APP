'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Tag, Settings, type LucideIcon } from 'lucide-react'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Extrato',       icon: ArrowLeftRight },
  { href: '/categories',   label: 'Categorias',    icon: Tag },
  { href: '/settings',     label: 'Configurações', icon: Settings },
]

export function Sidebar({ user: _ }: { user: unknown }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="hidden lg:flex flex-col absolute left-0 top-0 bottom-0 z-20 overflow-hidden"
      style={{
        width: open ? '200px' : '64px',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo area */}
      <div className="relative flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ height: '64px' }}>
        {/* Collapsed: icon only */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo-icon.png"
          alt="Logo"
          style={{
            height: '28px',
            width: 'auto',
            position: 'absolute',
            opacity: open ? 0 : 1,
            transition: 'opacity 0.15s',
            pointerEvents: 'none',
          }}
        />
        {/* Expanded: full logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo.png?v=2"
          alt="Logo"
          style={{
            height: '20px',
            width: 'auto',
            position: 'absolute',
            left: '18px',
            opacity: open ? 1 : 0,
            transition: 'opacity 0.18s 0.05s',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border)', margin: '0 12px' }} />

      {/* Nav */}
      <nav className="flex flex-col gap-1 w-full py-4 px-2 flex-1">
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
    ? 'rgba(124,90,252,0.14)'
    : hovered
    ? 'rgba(255,255,255,0.06)'
    : 'transparent'

  const border = active
    ? '1px solid rgba(124,90,252,0.22)'
    : hovered
    ? '1px solid rgba(255,255,255,0.08)'
    : '1px solid transparent'

  const color = active ? 'var(--accent)' : hovered ? 'var(--text-1)' : 'var(--text-3)'

  return (
    <Link
      href={href}
      title={!open ? label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center h-10 rounded-[12px] whitespace-nowrap overflow-hidden w-full"
      style={{
        background: bg,
        border,
        color,
        justifyContent: open ? 'flex-start' : 'center',
        padding: open ? '0 12px' : '0',
        boxShadow: active ? '0 0 16px rgba(124,90,252,0.08)' : 'none',
        transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Left accent bar */}
      <span
        className="absolute left-0 w-[3px] h-5 rounded-r-full"
        style={{
          background: 'var(--accent)',
          opacity: active ? 1 : hovered ? 0.45 : 0,
          transition: 'opacity 0.15s',
        }}
      />

      {/* Icon */}
      <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
        <Icon size={17} />
      </span>

      {/* Label */}
      <span
        className="text-[12px] font-medium ml-2.5 flex-shrink-0"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateX(0)' : 'translateX(-6px)',
          transition: 'opacity 0.18s, transform 0.18s',
        }}
      >
        {label}
      </span>
    </Link>
  )
}
