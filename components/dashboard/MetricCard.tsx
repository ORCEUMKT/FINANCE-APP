import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: number
  icon?: LucideIcon
  color?: string
  trend?: string
  className?: string
}

export function MetricCard({ label, value, icon: Icon, color = 'var(--accent)', trend, className }: MetricCardProps) {
  return (
    <Card
      className={cn('p-5 flex flex-col gap-0 overflow-hidden', className)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: `var(--shadow-card), inset 0 1px 0 ${color}22`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[9px] font-semibold uppercase tracking-[2px]"
          style={{ color: 'var(--text-3)' }}
        >
          {label}
        </span>
        {Icon && <Icon size={13} style={{ color: `${color}88`, flexShrink: 0 }} />}
      </div>

      <div
        className="text-[22px] sm:text-[30px] lg:text-[38px] font-bold leading-none tabular truncate"
        style={{ color, letterSpacing: '-0.03em' }}
      >
        {formatCurrency(value)}
      </div>

      {trend && (
        <p className="text-[10px] mt-2.5" style={{ color: 'var(--text-3)' }}>{trend}</p>
      )}
    </Card>
  )
}
