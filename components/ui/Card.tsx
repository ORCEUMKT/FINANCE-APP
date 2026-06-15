import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-[#13161a] border border-[#1e2226] rounded-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
