'use client'

import { useState, useEffect } from 'react'
import { Layers, Star, RefreshCw, Shuffle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSharedAccount } from '@/contexts/SharedAccountContext'
import { setupSharedCategories } from '@/services/sharedAccountService'
import { getCategories } from '@/services/categoriesService'
import { getGoals } from '@/services/goalsService'
import type { CategorySetupOption } from '@/types/sharedAccount'
import type { Category } from '@/types/category'
import type { CategoryGoal } from '@/types/goal'

const SETUP_OPTIONS: { key: CategorySetupOption; icon: React.ReactNode; title: string; description: string }[] = [
  {
    key: 'zero',
    icon: <Star size={16} />,
    title: 'Começar do zero',
    description: 'Criar a Conta Compartilhada sem categorias ou metas. Configure manualmente depois.',
  },
  {
    key: 'mine',
    icon: <Layers size={16} />,
    title: 'Usar minhas categorias e metas',
    description: 'Copiar minhas categorias e metas como base da conta compartilhada.',
  },
  {
    key: 'theirs',
    icon: <RefreshCw size={16} />,
    title: 'Usar categorias e metas do outro membro',
    description: 'Copiar as categorias e metas da outra pessoa como base.',
  },
  {
    key: 'merge',
    icon: <Shuffle size={16} />,
    title: 'Unificar categorias e metas dos dois',
    description: 'Juntar as categorias e metas de ambos, evitando duplicatas.',
  },
]

export function SharedAccountSetupModal() {
  const { sharedAccount, myMembership, members, needsCategorySetup, markSetupDone, broadcastChange } = useSharedAccount()

  const [selected, setSelected] = useState<CategorySetupOption>('zero')
  const [saving, setSaving] = useState(false)
  const [myCategories, setMyCategories] = useState<Category[]>([])
  const [myGoals, setMyGoals] = useState<CategoryGoal[]>([])
  const [loadedData, setLoadedData] = useState(false)
  const [autoApplying, setAutoApplying] = useState(false)

  useEffect(() => {
    if (!needsCategorySetup || loadedData) return
    Promise.all([getCategories(), getGoals()]).then(([cats, goals]) => {
      setMyCategories(cats)
      setMyGoals(goals)
      setLoadedData(true)
    })
  }, [needsCategorySetup, loadedData])

  // Auto-apply if inviter stored a pending setup option (theirs/merge)
  useEffect(() => {
    if (!needsCategorySetup || !sharedAccount || !myMembership || !loadedData || autoApplying) return
    const pending = localStorage.getItem(`shared_setup_pending_${sharedAccount.id}`)
    if (!pending) return
    const invitee = members.find((m) => m.user_id !== myMembership.user_id)
    if (!invitee) return
    setAutoApplying(true)
    localStorage.removeItem(`shared_setup_pending_${sharedAccount.id}`)
    setupSharedCategories(sharedAccount.id, pending as CategorySetupOption, myMembership.user_id, invitee.user_id, myCategories, myGoals)
      .then(() => broadcastChange())
      .catch(() => {})
      .finally(() => markSetupDone())
  }, [needsCategorySetup, sharedAccount?.id, myMembership?.user_id, loadedData, autoApplying, members]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!needsCategorySetup || !sharedAccount || !myMembership || autoApplying) return null

  // The invitee is whichever member is NOT the current user
  const invitee = members.find((m) => m.user_id !== myMembership.user_id)

  async function handleConfirm() {
    if (!sharedAccount || !myMembership || !invitee) return
    setSaving(true)
    try {
      await setupSharedCategories(
        sharedAccount.id,
        selected,
        myMembership.user_id,
        invitee.user_id,
        myCategories,
        myGoals
      )
      broadcastChange()
    } catch {
      // ignore errors silently — setup is best-effort
    } finally {
      setSaving(false)
      markSetupDone()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-md)' }}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-[17px] font-bold" style={{ color: 'var(--text-1)' }}>
            Configurar Conta Compartilhada
          </h2>
          <button
            onClick={markSetupDone}
            className="mt-0.5 p-1 rounded-lg transition-opacity hover:opacity-60"
            style={{ color: 'var(--text-3)' }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
          A conta compartilhada com <strong style={{ color: 'var(--text-2)' }}>{invitee?.name ?? 'o outro membro'}</strong> ainda não tem categorias. Escolha como organizar as categorias e metas da visão compartilhada.
        </p>

        <div className="flex flex-col gap-2 mb-5">
          {SETUP_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelected(opt.key)}
              className="text-left rounded-xl border px-4 py-3.5 transition-all"
              style={{
                borderColor: selected === opt.key ? 'var(--accent)' : 'var(--border-md)',
                background: selected === opt.key ? 'var(--accent-dim)' : 'transparent',
              }}
            >
              <div
                className="flex items-center gap-2.5 mb-1"
                style={{ color: selected === opt.key ? 'var(--accent)' : 'var(--text-2)' }}
              >
                {opt.icon}
                <span className="text-sm font-semibold">{opt.title}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                {opt.description}
              </p>
            </button>
          ))}
        </div>

        <Button size="sm" className="w-full" loading={saving} onClick={handleConfirm}>
          Confirmar
        </Button>
      </div>
    </div>
  )
}
