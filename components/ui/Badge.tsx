import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string
}

export function Badge({ className, color = '#A29BFE', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', className)}
      style={{ background: `${color}22`, color }}
      {...props}
    >
      {children}
    </span>
  )
}
