import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
          {
            'bg-[#00d4a0] text-[#0c0e10] hover:bg-[#00bf90] active:scale-[.98]': variant === 'primary',
            'bg-[#13161a] border border-[#1e2226] text-[#c4c9d0] hover:bg-[#1a1d22] hover:text-white': variant === 'secondary',
            'bg-transparent text-[#6b7280] hover:text-white hover:bg-[#13161a]': variant === 'ghost',
            'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15': variant === 'danger',
          },
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-5 text-base': size === 'lg',
          },
          className
        )}
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
