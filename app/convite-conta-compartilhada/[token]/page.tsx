'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { lookupInvitePageData, acceptInvite, setupSharedCategories } from '@/services/sharedAccountService'
import { getCategories } from '@/services/categoriesService'
import { getGoals } from '@/services/goalsService'
import type { InvitePageData, CategorySetupOption } from '@/types/sharedAccount'

type FlowStep = 'loading' | 'invalid' | 'confirm' | 'done' | 'error'

export default function InvitePage() {
  const params   = useParams<{ token: string }>()
  const router   = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [step, setStep]           = useState<FlowStep>('loading')
  const [pageData, setPageData]   = useState<InvitePageData | null>(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    async function load() {
      try {
        const data = await lookupInvitePageData(params.token)
        if (!data) { setStep('invalid'); return }
        setPageData(data)
        setStep('confirm')
      } catch {
        setStep('invalid')
      }
    }
    load()
  }, [params.token, authLoading])

  async function handleAccept() {
    if (!user) {
      router.push(`/login?redirect=/convite-conta-compartilhada/${params.token}`)
      return
    }
    setAccepting(true)
    try {
      const result = await acceptInvite(params.token)
      setStep('done')

      // Apply setup that the inviter configured (theirs/merge must run on invitee side
      // since they need the invitee's categories, which only exist in this browser)
      if (result.setupOption === 'theirs' || result.setupOption === 'merge') {
        try {
          const [cats, goals] = await Promise.all([getCategories(), getGoals()])
          // "theirs" from inviter's perspective = use THIS user's categories ("mine")
          // "merge"  = merge both users' categories
          const optionToApply: CategorySetupOption = result.setupOption === 'theirs' ? 'mine' : 'merge'
          await setupSharedCategories(result.sharedAccountId, optionToApply, user.id, result.inviterId, cats, goals)
        } catch {
          // best-effort — user will see empty categories but can create manually
        }
      }

      // Mark setup as done so the modal doesn't show after redirect
      localStorage.setItem(`shared_setup_done_${result.sharedAccountId}`, '1')

      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao aceitar convite.')
      setStep('error')
    } finally {
      setAccepting(false)
    }
  }

  const inviterName = pageData?.inviterName || 'Alguém'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--bg)' }}>
      <Card className="p-7 sm:p-8 max-w-md w-full">

        {/* Loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[.06] animate-pulse" />
            <div className="h-4 w-40 bg-white/[.06] rounded animate-pulse" />
          </div>
        )}

        {/* Invalid */}
        {step === 'invalid' && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white mb-1">Convite inválido</h1>
              <p className="text-sm text-white/50">Este link não existe, foi revogado ou já expirou.</p>
            </div>
          </div>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <>
            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Users size={24} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white mb-1">Unificar contas financeiras?</h1>
                <p className="text-sm text-white/50 leading-relaxed">
                  <span className="text-white/80 font-semibold">{inviterName}</span> convidou você para conectar sua conta à{' '}
                  <span className="text-white/80">{pageData?.account?.name ?? 'Conta Compartilhada'}</span>.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-white/[.03] p-4 mb-6 text-sm text-white/50 leading-relaxed space-y-2">
              <p>Ao aceitar, vocês poderão visualizar uma <span className="text-white/70">visão financeira unificada</span> com os lançamentos das contas conectadas.</p>
              <p className="text-white/40">Seus lançamentos continuarão vinculados ao seu usuário. A conta compartilhada apenas cria uma visão consolidada.</p>
              <div className="pt-2 space-y-1 text-white/40">
                <p className="font-semibold text-white/60 text-xs uppercase tracking-widest">Você poderá visualizar</p>
                <p>· Apenas minha conta</p>
                <p>· Conta unificada</p>
                <p>· Lançamentos por pessoa</p>
              </div>
            </div>

            {!user && (
              <p className="text-xs text-amber-400/80 bg-amber-400/[.06] border border-amber-400/20 rounded-xl px-3 py-2 mb-4 text-center">
                Você precisará fazer login para aceitar.
              </p>
            )}

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/[.08] border border-red-500/20 rounded-xl px-3 py-2 mb-4">{errorMsg}</p>
            )}

            <div className="flex gap-3">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => router.push('/dashboard')}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 gap-2" loading={accepting} onClick={handleAccept}>
                {user ? 'Unificar contas' : 'Entrar para aceitar'} <ArrowRight size={13} />
              </Button>
            </div>
          </>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white mb-1">Contas unificadas!</h1>
              <p className="text-sm text-white/50">Redirecionando para o dashboard...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white mb-1">Erro</h1>
              <p className="text-sm text-white/50">{errorMsg}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              Ir para o dashboard
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
