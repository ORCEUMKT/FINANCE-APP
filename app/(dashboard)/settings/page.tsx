'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User, Save, Users, Copy, Check, Link2, UserMinus, RefreshCw, Layers, Star, Shuffle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/authService'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import {
  createSharedAccount,
  getOrCreateInvite,
  revokeInvite,
  leaveSharedAccount,
  setupSharedCategories,
} from '@/services/sharedAccountService'
import { getCategories } from '@/services/categoriesService'
import { getGoals } from '@/services/goalsService'
import { useSharedAccount } from '@/contexts/SharedAccountContext'
import type { SharedAccountInvite, CategorySetupOption } from '@/types/sharedAccount'

const SETUP_OPTIONS: { key: CategorySetupOption; icon: React.ReactNode; title: string; description: string }[] = [
  { key: 'zero',   icon: <Star size={16} />,    title: 'Começar do zero',                      description: 'Criar sem categorias ou metas. Configure manualmente depois.' },
  { key: 'mine',   icon: <Layers size={16} />,  title: 'Usar minhas categorias e metas',       description: 'Copiar minhas categorias e metas como base da conta compartilhada.' },
  { key: 'theirs', icon: <RefreshCw size={16} />, title: 'Usar categorias do outro membro',    description: 'Copiar as categorias e metas da outra pessoa. Aplicado quando ele aceitar.' },
  { key: 'merge',  icon: <Shuffle size={16} />, title: 'Unificar categorias dos dois',         description: 'Juntar as categorias de ambos, evitando duplicatas. Aplicado quando ele aceitar.' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const { toast } = useToast()
  const { sharedAccount, members, loading: saLoading, refresh, clearAccount } = useSharedAccount()

  const [name, setName]   = useState('')
  const [saving, setSaving] = useState(false)

  const [invite, setInvite]           = useState<SharedAccountInvite | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [copied, setCopied]           = useState(false)
  const [leavingAccount, setLeavingAccount] = useState(false)

  // Setup picker (shown before invite is generated)
  const [setupOpen, setSetupOpen]       = useState(false)
  const [setupOption, setSetupOption]   = useState<CategorySetupOption>('zero')
  const [setupLoading, setSetupLoading] = useState(false)

  // Refresh shared account data on every visit to settings (catches changes made by the other member)
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Step 1: open setup picker
  function handleCreateInvite() {
    setSetupOption('zero')
    setSetupOpen(true)
  }

  // Step 2: confirm setup → create account + apply config → generate invite
  async function handleSetupConfirm() {
    setSetupLoading(true)
    try {
      let account = sharedAccount
      if (!account) {
        account = await createSharedAccount()
      }

      const supabase = createClient()
      const { data: { user: me } } = await supabase.auth.getUser()

      if (setupOption === 'zero') {
        localStorage.setItem(`shared_setup_done_${account.id}`, '1')
      } else if (setupOption === 'mine') {
        const [cats, goals] = await Promise.all([getCategories(), getGoals()])
        await setupSharedCategories(account.id, 'mine', me!.id, '', cats, goals)
        localStorage.setItem(`shared_setup_done_${account.id}`, '1')
      } else {
        // 'theirs' or 'merge' — store and apply automatically when partner accepts
        localStorage.setItem(`shared_setup_pending_${account.id}`, setupOption)
      }

      const inv = await getOrCreateInvite(account.id, setupOption)
      setInvite(inv)
      setSetupOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao gerar convite.', { type: 'error' })
    } finally {
      setSetupLoading(false)
    }
  }

  async function handleRevokeInvite() {
    if (!invite) return
    try {
      await revokeInvite(invite.id)
      setInvite(null)
      toast('Convite revogado.')
    } catch {
      toast('Erro ao revogar convite.', { type: 'error' })
    }
  }

  async function handleLeave() {
    if (!sharedAccount) return
    setLeavingAccount(true)
    try {
      await leaveSharedAccount(sharedAccount.id)
    } catch {
      // ignore
    } finally {
      setLeavingAccount(false)
    }
    // Clear local state immediately — do NOT call refresh() here,
    // it would re-fetch from DB and undo the clear if the DB update hasn't propagated
    clearAccount()
    setInvite(null)
    toast('Você saiu da conta compartilhada.')
  }

  function copyLink() {
    if (!invite) return
    const url = `${window.location.origin}/convite-conta-compartilhada/${invite.token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const inviteUrl = invite
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/convite-conta-compartilhada/${invite.token}`
    : ''

  // Solo = account exists but no partner (awaiting invite or partner left)
  const isSolo = !!sharedAccount && members.length < 2

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

      {/* Conta Compartilhada */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} className="text-white/40" />
          <h3 className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">Conta Compartilhada</h3>
        </div>

        {saLoading ? (
          <div className="flex flex-col gap-2 pt-3">
            <div className="h-3 w-48 rounded bg-white/[.06] animate-pulse" />
            <div className="h-3 w-32 rounded bg-white/[.06] animate-pulse" />
          </div>
        ) : (!sharedAccount || isSolo) ? (
          /* No account, OR account exists but no partner yet (fresh or partner left) */
          <>
            {isSolo ? (
              <div className="mt-3 mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[.06] px-4 py-3">
                <p className="text-xs text-amber-400/90 font-semibold mb-1">Nenhum parceiro ativo</p>
                <p className="text-xs text-white/40 leading-relaxed">
                  Gere um novo convite para adicionar um parceiro, ou saia para encerrar a conta.
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/50 mt-3 mb-4 leading-relaxed">
                Conecte sua conta com outra pessoa para visualizar uma visão financeira unificada, mantendo os lançamentos individuais de cada usuário.
              </p>
            )}

            {!invite ? (
              <Button size="sm" className="gap-1.5" loading={loadingInvite} onClick={handleCreateInvite}>
                <Link2 size={13} /> {isSolo ? 'Gerar novo convite' : 'Criar link de convite'}
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2.5">
                  <p className="text-[10px] font-600 uppercase tracking-widest text-white/30 mb-1">Link de convite</p>
                  <p className="text-xs text-white/60 break-all leading-relaxed">{inviteUrl}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="gap-1.5 flex-1" onClick={copyLink}>
                    {copied ? <><Check size={13} className="text-emerald-400" /> Copiado</> : <><Copy size={13} /> Copiar link</>}
                  </Button>
                  <Button size="sm" variant="danger" className="gap-1.5 flex-1" onClick={handleRevokeInvite}>
                    Revogar
                  </Button>
                </div>
              </div>
            )}

            {isSolo && (
              <Button size="sm" variant="ghost" className="gap-1.5 mt-2 text-red-400 hover:text-red-300" loading={leavingAccount} onClick={handleLeave}>
                <UserMinus size={13} /> Sair da conta compartilhada
              </Button>
            )}
          </>
        ) : (
          /* Has shared account with 2 members */
          <>
            <div className="mt-3 mb-4">
              <p className="text-sm font-semibold text-white/80 mb-3">{sharedAccount.name}</p>
              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/[.05] last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/[.08] border border-white/[.1] flex items-center justify-center text-[11px] font-700 text-white/70">
                        {getInitials(m.name || 'U')}
                      </div>
                      <div>
                        <p className="text-xs text-white/70">{m.name || 'Usuário'}</p>
                        <p className="text-[10px] text-white/30 capitalize">{m.role === 'admin' ? 'Admin' : 'Membro'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-600 capitalize"
                      style={{ background: 'rgba(78,204,163,.1)', color: 'var(--accent)' }}>
                      {m.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {members.length >= 2 ? (
                <p className="text-xs text-white/40 leading-relaxed">
                  Conta completa — máximo de 2 membros atingido.
                </p>
              ) : !invite ? (
                <Button size="sm" variant="ghost" className="gap-1.5" loading={loadingInvite} onClick={handleCreateInvite}>
                  <RefreshCw size={13} /> Gerar novo convite
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2.5">
                    <p className="text-[10px] font-600 uppercase tracking-widest text-white/30 mb-1">Link de convite ativo</p>
                    <p className="text-xs text-white/60 break-all leading-relaxed">{inviteUrl}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="gap-1.5 flex-1" onClick={copyLink}>
                      {copied ? <><Check size={13} className="text-emerald-400" /> Copiado</> : <><Copy size={13} /> Copiar</>}
                    </Button>
                    <Button size="sm" variant="danger" className="gap-1.5 flex-1" onClick={handleRevokeInvite}>
                      Revogar
                    </Button>
                  </div>
                </div>
              )}

              <Button size="sm" variant="ghost" className="gap-1.5 text-red-400 hover:text-red-300" loading={leavingAccount} onClick={handleLeave}>
                <UserMinus size={13} /> Sair da conta compartilhada
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Sign out */}
      <Card className="p-5">
        <h3 className="text-[10px] font-700 uppercase tracking-[2px] text-white/40 mb-4">Sessão</h3>
        <Button variant="danger" onClick={handleSignOut} size="sm" className="gap-1.5">
          <LogOut size={13} /> Sair da conta
        </Button>
      </Card>

      {/* Setup picker overlay */}
      {setupOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-7"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-md)' }}>
            <h2 className="text-[17px] font-bold mb-1" style={{ color: 'var(--text-1)' }}>
              Configurar Conta Compartilhada
            </h2>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
              Escolha como organizar as categorias e metas antes de enviar o convite.
            </p>
            <div className="flex flex-col gap-2 mb-5">
              {SETUP_OPTIONS.map((opt) => (
                <button key={opt.key} onClick={() => setSetupOption(opt.key)}
                  className="text-left rounded-xl border px-4 py-3.5 transition-all"
                  style={{
                    borderColor: setupOption === opt.key ? 'var(--accent)' : 'var(--border-md)',
                    background: setupOption === opt.key ? 'var(--accent-dim)' : 'transparent',
                  }}>
                  <div className="flex items-center gap-2.5 mb-1"
                    style={{ color: setupOption === opt.key ? 'var(--accent)' : 'var(--text-2)' }}>
                    {opt.icon}
                    <span className="text-sm font-semibold">{opt.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{opt.description}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSetupOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-[2]" loading={setupLoading} onClick={handleSetupConfirm}>
                Confirmar e gerar link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
