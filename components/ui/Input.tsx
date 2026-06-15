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
          <label htmlFor={id} className="text-[9px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn('w-full rounded-[12px] px-4 py-2 text-[13px] outline-none transition-all duration-150', className)}
          style={{
            background: 'var(--surface)',
            border: `1px solid ${error ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
            color: 'var(--text-1)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = error ? 'rgba(248,113,113,0.45)' : 'var(--border-strong)' }}
          onBlur={e => { e.currentTarget.style.borderColor = error ? 'rgba(248,113,113,0.25)' : 'var(--border)' }}
          {...props}
        />
        {error && <p className="text-[11px]" style={{ color: '#f87171' }}>{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
