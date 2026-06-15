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
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {Icon && (
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Icon size={18} style={{ color: 'var(--text-3)' }} />
        </div>
      )}
      <h3 className="text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>{title}</h3>
      {description && (
        <p className="text-[11px] max-w-[200px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
