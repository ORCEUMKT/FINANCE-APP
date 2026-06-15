import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#0c0e10]">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0 pb-24 lg:pb-0 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-5 py-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
