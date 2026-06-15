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
          'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
          {
            'bg-white text-[#050506] hover:bg-white/90 active:scale-[.98]': variant === 'primary',
            'bg-white/[.06] border border-white/10 text-white/70 hover:bg-white/10 hover:text-white': variant === 'secondary',
            'bg-transparent text-white/50 hover:text-white hover:bg-white/[.06]': variant === 'ghost',
            'bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20': variant === 'danger',
          },
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-11 px-4 text-sm': size === 'md',
            'h-13 px-5 text-base': size === 'lg',
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
