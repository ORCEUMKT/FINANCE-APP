import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title = 'Nada aqui ainda', description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-white/[.04] border border-white/[.07] flex items-center justify-center mb-4">
          <Icon size={24} className="text-white/25" />
        </div>
      )}
      <h3 className="text-sm font-700 text-white/45 mb-1">{title}</h3>
      {description && <p className="text-xs text-white/25 max-w-[240px]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
