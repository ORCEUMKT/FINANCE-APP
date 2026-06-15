import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { TopBar } from '@/components/layout/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    // pt-11 aqui: toda a área abaixo começa em y=44, então absolute top-0 da Sidebar fica abaixo da TopBar
    <div className="relative flex flex-col min-h-screen pt-11" style={{ background: 'var(--bg)' }}>
      {/* Blobs para o backdrop-blur dos cards glass funcionar */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div style={{ position:'absolute', top:'8%', left:'25%', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle, rgba(124,90,252,0.09) 0%, transparent 70%)', filter:'blur(80px)' }} />
        <div style={{ position:'absolute', bottom:'15%', right:'20%', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(circle, rgba(62,207,142,0.05) 0%, transparent 70%)', filter:'blur(100px)' }} />
        <div style={{ position:'absolute', top:'55%', left:'10%', width:'300px', height:'300px', borderRadius:'50%', background:'radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 70%)', filter:'blur(80px)' }} />
      </div>

      <TopBar user={user} />

      <div className="flex flex-1 relative">
        <Sidebar user={user} />
        <main className="flex-1 min-w-0 pb-24 lg:pb-0 overflow-y-auto relative z-10 lg:pl-14">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
