import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-gradient-to-br from-white/[.058] to-white/[.018]',
        'border border-white/[.09] rounded-2xl',
        'shadow-[inset_0_1px_0_rgba(255,255,255,.05)]',
        'backdrop-blur-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
