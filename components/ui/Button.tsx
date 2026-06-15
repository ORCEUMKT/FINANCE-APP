import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, style, ...props }, ref) => {
    const vs: React.CSSProperties =
      variant === 'primary'   ? { background: 'var(--accent)', color: '#fff', boxShadow: 'var(--glow-accent)' } :
      variant === 'secondary' ? { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' } :
      variant === 'ghost'     ? { background: 'transparent', color: 'var(--text-2)' } :
                                { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-[12px] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[.97]',
          {
            'h-8 px-3 text-[12px]': size === 'sm',
            'h-10 px-4 text-[13px]': size === 'md',
            'h-12 px-5 text-[14px]': size === 'lg',
          },
          className
        )}
        style={{ ...vs, ...style }}
        {...props}
      >
        {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
