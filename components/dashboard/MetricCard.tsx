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
    <Card className={cn('p-5', className)}>
      <div className="flex items-center gap-2.5 mb-5">
        {Icon && (
          <span
            className="w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18`, color }}
          >
            <Icon size={14} />
          </span>
        )}
        <span
          className="text-[11px] font-medium uppercase tracking-[1.2px]"
          style={{ color: 'var(--text-3)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-[26px] font-semibold leading-none tabular"
        style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}
      >
        {formatCurrency(value)}
      </div>
      {trend && (
        <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-3)' }}>{trend}</p>
      )}
    </Card>
  )
}
