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

export function MetricCard({ label, value, icon: Icon, color = '#00d4a0', trend, className }: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center gap-2.5 mb-3">
        {Icon && (
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18`, color }}
          >
            <Icon size={14} />
          </span>
        )}
        <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[24px] font-bold tracking-tight text-white leading-none">
        {formatCurrency(value)}
      </div>
      {trend && <p className="text-[11px] text-[#6b7280] mt-2">{trend}</p>}
    </Card>
  )
}
