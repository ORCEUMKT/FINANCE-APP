import { TrendingUp } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-10">
          <div className="w-9 h-9 rounded-xl bg-[#00d4a0] flex items-center justify-center">
            <TrendingUp size={17} className="text-[#0c0e10]" />
          </div>
          <span className="text-base font-black tracking-[3px] uppercase text-white">Finance</span>
        </div>
        {children}
      </div>
    </div>
  )
}
