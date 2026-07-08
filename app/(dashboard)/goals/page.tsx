'use client'

import { useState, useEffect } from 'react'
import { Target, Edit2, Trash2, Check, X } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { useGoals } from '@/hooks/useGoals'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useUnifiedDashboardMetrics } from '@/hooks/useUnifiedDashboardMetrics'
import { useSharedAccount } from '@/contexts/SharedAccountContext'
import { getSharedCategories, getSharedGoals, upsertSharedGoal, deleteSharedGoal } from '@/services/sharedAccountService'
import { AccountViewSelector } from '@/components/shared/AccountViewSelector'
import { MonthPicker, monthRange } from '@/components/ui/MonthPicker'
import { useSelectedMonth } from '@/contexts/MonthContext'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/formatters'
import type { Category } from '@/types/category'
import type { CategoryGoal } from '@/types/goal'
import type { SharedCategory, SharedGoal } from '@/types/sharedAccount'

const STATUS_COLOR = { ok: 'var(--green)', warning: 'var(--orange)', over: 'var(--red)' } as const
const STATUS_LABEL = { ok: 'Dentro da meta', warning: 'Atenção', over: 'Ultrapassou' } as const

export default function GoalsPage() {
  const { month: selectedMonth, setMonth: setSelectedMonth } = useSelectedMonth()
  const { dateFrom, dateTo } = monthRange(selectedMonth)

  const { categories, loading: catLoading } = useCategories()
  const { goals, loading: goalsLoading, upsert, remove } = useGoals()
  const { metrics: personalMetrics, loading: personalMetricsLoading } = useDashboardMetrics(dateFrom, dateTo)

  const { sharedAccount, members, myMembership, unifiedMode, filterUserId, setUnifiedMode, setFilterUserId } = useSharedAccount()
  const { metrics: unifiedMetrics, loading: unifiedMetricsLoading } = useUnifiedDashboardMetrics(
    unifiedMode ? (sharedAccount?.id ?? null) : null,
    unifiedMode ? filterUserId : null, // filter spending by selected account when active
    dateFrom,
    dateTo
  )

  const [sharedCats, setSharedCats]   = useState<SharedCategory[]>([])
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([])
  const [sharedGoalsLoading, setSharedGoalsLoading] = useState(false)

  const { toast } = useToast()
  // Personal goal editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft]         = useState('')
  const [saving, setSaving]       = useState(false)
  // Shared goal editing
  const [sharedEditingId, setSharedEditingId] = useState<string | null>(null)
  const [sharedDraft, setSharedDraft]         = useState('')
  const [sharedSaving, setSharedSaving]       = useState(false)

  useEffect(() => {
    if (!unifiedMode || !sharedAccount) { setSharedCats([]); setSharedGoals([]); return }
    setSharedGoalsLoading(true)
    Promise.all([
      getSharedCategories(sharedAccount.id),
      getSharedGoals(sharedAccount.id),
    ])
      .then(([cats, goals]) => { setSharedCats(cats); setSharedGoals(goals) })
      .catch(() => { setSharedCats([]); setSharedGoals([]) })
      .finally(() => setSharedGoalsLoading(false))
  }, [unifiedMode, sharedAccount?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Account view options
  const viewOptions = sharedAccount && members.length >= 2
    ? [
        { key: 'all', label: 'Conta unificada', unified: true },
        { key: 'personal', label: 'Minha conta', unified: false },
        ...members
          .filter((m) => m.user_id !== myMembership?.user_id)
          .map((m) => ({ key: m.user_id, label: m.name || 'Membro', unified: true })),
      ]
    : null
  const activeViewKey = !unifiedMode ? 'personal' : (filterUserId ?? 'all')
  function selectView(key: string) {
    if (key === 'personal') { setUnifiedMode(false); return }
    setUnifiedMode(true)
    setFilterUserId(key === 'all' ? null : key)
  }

  // ── Personal goals logic ──────────────────────────────────────────────────
  const metrics = personalMetrics
  const relevant = categories.filter((c) => c.type !== 'income')
  const personalLoading = catLoading || goalsLoading || personalMetricsLoading

  const totalBudget = goals.reduce((s, g) => s + g.amount, 0)
  const totalSpent  = goals.reduce((s, g) => {
    const rank = metrics?.categoryRanking.find((r) => r.category_id === g.category_id)
    return s + (rank?.total ?? 0)
  }, 0)
  const totalPct       = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const totalRemaining = totalBudget - totalSpent
  const totalStatus: 'ok' | 'warning' | 'over' =
    totalSpent > totalBudget ? 'over' : (totalSpent / totalBudget) >= 0.8 ? 'warning' : 'ok'

  function startEdit(cat: Category, goal?: CategoryGoal) {
    setEditingId(cat.id); setDraft(goal ? String(goal.amount) : '')
  }
  function cancelEdit() { setEditingId(null); setDraft('') }

  async function saveGoal(categoryId: string) {
    const amount = parseFloat(draft.replace(',', '.'))
    if (!amount || amount <= 0) { toast('Informe um valor válido.', { type: 'error' }); return }
    setSaving(true)
    try { await upsert({ category_id: categoryId, amount }); toast('Meta salva!'); setEditingId(null) }
    catch (err: unknown) { toast(err instanceof Error ? err.message : 'Erro ao salvar meta.', { type: 'error' }) }
    finally { setSaving(false) }
  }

  async function deleteGoal(categoryId: string) {
    if (!confirm('Remover meta desta categoria?')) return
    await remove(categoryId); toast('Meta removida.')
  }

  // ── Shared goals CRUD ─────────────────────────────────────────────────────
  function startEditShared(cat: SharedCategory, goal?: SharedGoal) {
    setSharedEditingId(cat.id); setSharedDraft(goal ? String(goal.amount) : '')
  }
  function cancelEditShared() { setSharedEditingId(null); setSharedDraft('') }

  async function saveSharedGoal(cat: SharedCategory) {
    if (!sharedAccount) return
    const amount = parseFloat(sharedDraft.replace(',', '.'))
    if (!amount || amount <= 0) { toast('Informe um valor válido.', { type: 'error' }); return }
    setSharedSaving(true)
    try {
      const saved = await upsertSharedGoal(sharedAccount.id, cat.id, amount)
      setSharedGoals((prev) => {
        const exists = prev.find((g) => g.shared_category_id === cat.id)
        return exists ? prev.map((g) => g.shared_category_id === cat.id ? saved : g) : [...prev, saved]
      })
      toast('Meta salva!'); setSharedEditingId(null)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar meta.', { type: 'error' })
    } finally {
      setSharedSaving(false)
    }
  }

  async function deleteSharedGoalById(goal: SharedGoal) {
    if (!confirm('Remover meta desta categoria compartilhada?')) return
    await deleteSharedGoal(goal.id)
    setSharedGoals((prev) => prev.filter((g) => g.id !== goal.id))
    toast('Meta removida.')
  }

  // ── Unified goals logic ───────────────────────────────────────────────────
  const unifiedLoading = sharedGoalsLoading || unifiedMetricsLoading

  // When a specific member is selected, show only their contributed categories/goals
  const displayedSharedCats = (unifiedMode && filterUserId)
    ? sharedCats.filter((c) => c.created_from_user_id === filterUserId)
    : sharedCats

  const displayedSharedGoals = (unifiedMode && filterUserId)
    ? sharedGoals.filter((g) => displayedSharedCats.some((c) => c.id === g.shared_category_id))
    : sharedGoals

  const sharedTotalBudget = displayedSharedGoals.reduce((s, g) => s + g.amount, 0)
  const sharedTotalSpent = displayedSharedGoals.reduce((s, g) => {
    const cat = displayedSharedCats.find((c) => c.id === g.shared_category_id)
    const origCatId = cat?.original_category_id ?? g.shared_category?.original_category_id
    if (!origCatId) return s
    const rank = unifiedMetrics?.expenseCategoryRanking.find((r) => r.category_id === origCatId)
    return s + (rank?.total ?? 0)
  }, 0)
  const sharedTotalPct = sharedTotalBudget > 0 ? Math.min((sharedTotalSpent / sharedTotalBudget) * 100, 100) : 0
  const sharedTotalRemaining = sharedTotalBudget - sharedTotalSpent
  const sharedTotalStatus: 'ok' | 'warning' | 'over' =
    sharedTotalSpent > sharedTotalBudget ? 'over' : (sharedTotalSpent / sharedTotalBudget) >= 0.8 ? 'warning' : 'ok'

  const loading = unifiedMode ? unifiedLoading : personalLoading

  return (
    <div className="flex flex-col gap-5">
      {/* Account selector — first on mobile */}
      {viewOptions && (
        <div className="lg:hidden">
          <AccountViewSelector options={viewOptions} activeKey={activeViewKey} onChange={selectView} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-1)' }}>Metas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {unifiedMode ? 'Metas da conta compartilhada' : 'Defina limites de gasto por categoria e acompanhe'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewOptions && (
            <div className="hidden lg:block">
              <AccountViewSelector options={viewOptions} activeKey={activeViewKey} onChange={selectView} />
            </div>
          )}
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--border-md)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : unifiedMode ? (
        /* ── UNIFIED GOALS VIEW ── */
        displayedSharedCats.length === 0 ? (
          <EmptyState icon={Target} title="Sem categorias compartilhadas"
            description="Configure categorias na aba Categorias para definir metas" />
        ) : (
          <>
            {displayedSharedGoals.length > 0 && sharedTotalBudget > 0 && (
              <Card className="p-4 flex flex-col gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
                  Resumo unificado · {displayedSharedGoals.length} {displayedSharedGoals.length === 1 ? 'meta' : 'metas'}
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${sharedTotalPct}%`, background: STATUS_COLOR[sharedTotalStatus] }} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Orçamento', value: sharedTotalBudget, color: 'var(--text-1)' },
                    { label: 'Gasto', value: sharedTotalSpent, color: STATUS_COLOR[sharedTotalStatus] },
                    { label: sharedTotalRemaining >= 0 ? 'Restante' : 'Excesso', value: Math.abs(sharedTotalRemaining), color: sharedTotalRemaining >= 0 ? 'var(--green)' : 'var(--red)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-[1.5px]" style={{ color: 'var(--text-3)' }}>{label}</span>
                      <span className="text-[14px] font-bold tabular" style={{ color }}>{formatCurrency(value)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: 'var(--text-3)' }}>{sharedTotalPct.toFixed(0)}% do orçamento utilizado</span>
                  <span className="font-semibold" style={{ color: STATUS_COLOR[sharedTotalStatus] }}>{STATUS_LABEL[sharedTotalStatus]}</span>
                </div>
              </Card>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedSharedCats.map((cat) => {
                const goal = displayedSharedGoals.find((g) => g.shared_category_id === cat.id)
                const origCatId = cat.original_category_id
                const rank = origCatId ? unifiedMetrics?.expenseCategoryRanking.find((r) => r.category_id === origCatId) : null
                const spent = rank?.total ?? 0
                const pct = goal && goal.amount > 0 ? (spent / goal.amount) * 100 : 0
                const status: 'ok' | 'warning' | 'over' = pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'ok'
                const isEditing = sharedEditingId === cat.id
                return (
                  <Card key={cat.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{cat.name}</span>
                      </div>
                      {goal && !isEditing && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => startEditShared(cat, goal)}
                            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/[.06]"
                            style={{ color: 'var(--text-3)' }}><Edit2 size={11} /></button>
                          <button onClick={() => deleteSharedGoalById(goal)}
                            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/[.06]"
                            style={{ color: 'var(--text-3)' }}><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input autoFocus type="number" step="0.01" min="0.01" placeholder="Ex: 500,00"
                          value={sharedDraft} onChange={(e) => setSharedDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveSharedGoal(cat); if (e.key === 'Escape') cancelEditShared() }}
                          className="flex-1 rounded-[10px] px-3 py-2 text-sm outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
                        <button onClick={() => saveSharedGoal(cat)} disabled={sharedSaving}
                          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}><Check size={13} /></button>
                        <button onClick={cancelEditShared}
                          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)' }}><X size={13} /></button>
                      </div>
                    ) : goal ? (
                      <>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(pct, 100)}%`, background: STATUS_COLOR[status] }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="tabular" style={{ color: 'var(--text-3)' }}>
                            {formatCurrency(spent)} de {formatCurrency(goal.amount)}
                          </span>
                          <span className="tabular font-semibold" style={{ color: STATUS_COLOR[status] }}>{pct.toFixed(0)}%</span>
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
                      </>
                    ) : (
                      <button onClick={() => startEditShared(cat)}
                        className="flex items-center justify-center gap-1.5 h-9 rounded-[10px] text-[11px] font-medium transition-opacity hover:opacity-70"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                        <Target size={12} /> Definir meta
                      </button>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        )
      ) : (
        /* ── PERSONAL GOALS VIEW ── */
        relevant.length === 0 ? (
          <EmptyState icon={Target} title="Sem categorias" description="Crie categorias de despesa para definir metas" />
        ) : (
          <>
            {goals.length > 0 && (
              <Card className="p-4 flex flex-col gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
                  Resumo geral · {goals.length} {goals.length === 1 ? 'meta' : 'metas'}
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalPct}%`, background: STATUS_COLOR[totalStatus] }} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Orçamento', value: totalBudget, color: 'var(--text-1)' },
                    { label: 'Gasto', value: totalSpent, color: STATUS_COLOR[totalStatus] },
                    { label: totalRemaining >= 0 ? 'Restante' : 'Excesso', value: Math.abs(totalRemaining), color: totalRemaining >= 0 ? 'var(--green)' : 'var(--red)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-[1.5px]" style={{ color: 'var(--text-3)' }}>{label}</span>
                      <span className="text-[14px] font-bold tabular" style={{ color }}>{formatCurrency(value)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: 'var(--text-3)' }}>{totalPct.toFixed(0)}% do orçamento utilizado</span>
                  <span className="font-semibold" style={{ color: STATUS_COLOR[totalStatus] }}>{STATUS_LABEL[totalStatus]}</span>
                </div>
              </Card>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {relevant.map((cat) => {
                const goal = goals.find((g) => g.category_id === cat.id)
                const rank = metrics?.categoryRanking.find((r) => r.category_id === cat.id)
                const spent = rank?.total ?? 0
                const percentage = goal && goal.amount > 0 ? (spent / goal.amount) * 100 : 0
                const status: 'ok' | 'warning' | 'over' = percentage > 100 ? 'over' : percentage >= 80 ? 'warning' : 'ok'
                const isEditing = editingId === cat.id
                return (
                  <Card key={cat.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{cat.name}</span>
                      </div>
                      {goal && !isEditing && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => startEdit(cat, goal)}
                            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/[.06]"
                            style={{ color: 'var(--text-3)' }}><Edit2 size={11} /></button>
                          <button onClick={() => deleteGoal(cat.id)}
                            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/[.06]"
                            style={{ color: 'var(--text-3)' }}><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input autoFocus type="number" step="0.01" min="0.01" placeholder="Ex: 500,00"
                          value={draft} onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(cat.id); if (e.key === 'Escape') cancelEdit() }}
                          className="flex-1 rounded-[10px] px-3 py-2 text-sm outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
                        <button onClick={() => saveGoal(cat.id)} disabled={saving}
                          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}><Check size={13} /></button>
                        <button onClick={cancelEdit}
                          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)' }}><X size={13} /></button>
                      </div>
                    ) : goal ? (
                      <>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(percentage, 100)}%`, background: STATUS_COLOR[status] }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="tabular" style={{ color: 'var(--text-3)' }}>
                            {formatCurrency(spent)} de {formatCurrency(goal.amount)}
                          </span>
                          <span className="tabular font-semibold" style={{ color: STATUS_COLOR[status] }}>{percentage.toFixed(0)}%</span>
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
                      </>
                    ) : (
                      <button onClick={() => startEdit(cat)}
                        className="flex items-center justify-center gap-1.5 h-9 rounded-[10px] text-[11px] font-medium transition-opacity hover:opacity-70"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                        <Target size={12} /> Definir meta
                      </button>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        )
      )}
    </div>
  )
}
