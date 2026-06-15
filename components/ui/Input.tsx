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
          <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[2px] text-white/40">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-white/[.055] border border-white/10 rounded-[14px] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200',
            'focus:border-white/25 focus:bg-white/[.08]',
            error && 'border-red-500/50 focus:border-red-500/70',
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
