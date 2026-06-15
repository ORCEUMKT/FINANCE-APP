import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="relative flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 pb-24 lg:pb-0 overflow-y-auto relative z-10">
        <div className="max-w-[1100px] mx-auto px-8 py-8">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
