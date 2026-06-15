import { TrendingUp } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div
            className="w-9 h-9 rounded-[12px] flex items-center justify-center"
            style={{ background: 'var(--accent)', boxShadow: 'var(--glow-accent)' }}
          >
            <TrendingUp size={17} className="text-white" />
          </div>
          <span
            className="text-[14px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: 'var(--text-1)' }}
          >
            Finance
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
