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
          <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-[#13161a] border border-[#1e2226] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#6b7280] outline-none transition-all duration-150',
            'focus:border-[#00d4a0]/40 focus:bg-[#13161a]',
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
