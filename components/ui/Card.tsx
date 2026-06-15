import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-[#1e2235] border border-[#2a2f4a] rounded-2xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
