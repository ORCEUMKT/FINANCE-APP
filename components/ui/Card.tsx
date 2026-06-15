import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

export function Card({ className, children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[18px]', className)}
      style={{
        background: 'rgba(18,18,28,0.55)',
        border: '1px solid rgba(255,255,255,0.09)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.35)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
