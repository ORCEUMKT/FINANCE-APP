import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, style, ...props }, ref) => {
    const variantStyle: React.CSSProperties =
      variant === 'primary'   ? { background: 'var(--accent)', color: '#fff', boxShadow: 'var(--glow-accent)' } :
      variant === 'secondary' ? { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' } :
      variant === 'ghost'     ? { background: 'transparent', color: 'var(--text-2)' } :
                                { background: 'rgba(244,115,115,0.08)', border: '1px solid rgba(244,115,115,0.18)', color: '#f47373' }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed active:scale-[.97]',
          {
            'rounded-[12px]': true,
            'h-8 px-3 text-[12px]': size === 'sm',
            'h-10 px-4 text-[13px]': size === 'md',
            'h-12 px-5 text-[14px]': size === 'lg',
          },
          className
        )}
        style={{ ...variantStyle, ...style }}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
