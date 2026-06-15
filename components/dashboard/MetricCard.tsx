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

export function MetricCard({ label, value, icon: Icon, color = '#5b8af5', trend, className }: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center gap-2.5 mb-4">
        {Icon && (
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}20`, color }}
          >
            <Icon size={15} />
          </span>
        )}
        <span className="text-[12px] font-medium text-[#8b92b5]">{label}</span>
      </div>
      <div className="text-[26px] font-bold tracking-tight text-white leading-none">
        {formatCurrency(value)}
      </div>
      {trend && <p className="text-[11px] text-[#8b92b5] mt-2">{trend}</p>}
    </Card>
  )
}
