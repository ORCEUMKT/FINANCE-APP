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

export function MetricCard({ label, value, icon: Icon, color = '#fff', trend, className }: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">{label}</span>
        {Icon && (
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18`, color }}
          >
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="text-[22px] font-800 tracking-tight text-white leading-none">
        {formatCurrency(value)}
      </div>
      {trend && <p className="text-[11px] text-white/35 mt-1.5">{trend}</p>}
    </Card>
  )
}
