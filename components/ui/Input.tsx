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
          <label
            htmlFor={id}
            className="text-[10px] font-semibold uppercase tracking-[1.5px]"
            style={{ color: 'var(--text-3)' }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-[12px] px-4 py-2.5 text-[13px] outline-none transition-all duration-150',
            error ? 'border-red-500/30' : '',
            className
          )}
          style={{
            background: 'var(--surface)',
            border: `1px solid ${error ? 'rgba(244,115,115,0.3)' : 'var(--border)'}`,
            color: 'var(--text-1)',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = error ? 'rgba(244,115,115,0.5)' : 'var(--border-strong)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = error ? 'rgba(244,115,115,0.3)' : 'var(--border)'
          }}
          {...props}
        />
        {error && <p className="text-[11px]" style={{ color: '#f47373' }}>{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
