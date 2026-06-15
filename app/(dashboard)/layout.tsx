import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="relative z-10 min-h-screen">
      <div className="max-w-[1360px] mx-auto px-4 lg:px-5 py-5 lg:py-5 flex gap-5 items-start">
        <Sidebar user={user} />
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
