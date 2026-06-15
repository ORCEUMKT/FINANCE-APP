import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-[#8b92b5]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-[#1e2235] border border-[#2a2f4a] rounded-xl px-4 py-2.5 text-sm text-[#e2e4f0] placeholder:text-[#8b92b5] outline-none transition-all duration-150',
            'focus:border-[#5b8af5]/50 focus:ring-1 focus:ring-[#5b8af5]/20',
            error && 'border-red-500/40 focus:border-red-500/60',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
