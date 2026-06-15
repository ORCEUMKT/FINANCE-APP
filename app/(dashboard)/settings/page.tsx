'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User, Save } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/authService'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'

export default function SettingsPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const { toast } = useToast()

  const [name, setName]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.user_metadata?.name ?? '')
  }, [user])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    try {
      await supabase.auth.updateUser({ data: { name } })
      await supabase.from('profiles').update({ name }).eq('id', user.id)
      toast('Perfil atualizado!')
    } catch {
      toast('Erro ao salvar.', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-1)' }}>Configurações</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Gerencie seu perfil</p>
      </div>

      {/* Profile */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-white/[.1] border border-white/[.12] flex items-center justify-center text-sm font-900 text-white flex-shrink-0">
            {getInitials(name || user?.email)}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <User size={12} className="text-white/40" />
              <span className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">Perfil</span>
            </div>
            <p className="text-xs text-white/50">{user?.email}</p>
          </div>
        </div>
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} className="mb-4" />
        <Button onClick={saveProfile} loading={saving} size="sm" className="gap-1.5">
          <Save size={13} /> Salvar perfil
        </Button>
      </Card>

      {/* Sign out */}
      <Card className="p-5">
        <h3 className="text-[10px] font-700 uppercase tracking-[2px] text-white/40 mb-4">Sessão</h3>
        <Button variant="danger" onClick={handleSignOut} size="sm" className="gap-1.5">
          <LogOut size={13} /> Sair da conta
        </Button>
      </Card>
    </div>
  )
}
