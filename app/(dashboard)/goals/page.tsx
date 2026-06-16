'use client'

import { useState } from 'react'
import { Target, Edit2, Trash2, Check, X } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { useGoals } from '@/hooks/useGoals'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { MonthPicker, monthRange, currentMonth, type MonthValue } from '@/components/ui/MonthPicker'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/formatters'
import type { Category } from '@/types/category'
import type { CategoryGoal } from '@/types/goal'

const STATUS_COLOR = { ok: 'var(--green)', warning: 'var(--orange)', over: 'var(--red)' } as const
const STATUS_LABEL = { ok: 'Dentro da meta', warning: 'Atenção', over: 'Ultrapassou' } as const

export default function GoalsPage() {
  const [selectedMonth, setSelectedMonth] = useState<MonthValue>(currentMonth)
  const { dateFrom, dateTo } = monthRange(selectedMonth)
  const { categories, loading: catLoading } = useCategories()
  const { goals, loading: goalsLoading, upsert, remove } = useGoals()
  const { metrics, loading: metricsLoading } = useDashboardMetrics(dateFrom, dateTo)
  const { toast } = useToast()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft]         = useState('')
  const [saving, setSaving]       = useState(false)

  const loading = catLoading || goalsLoading || metricsLoading
  const relevant = categories.filter((c) => c.type !== 'income')

  function startEdit(cat: Category, goal?: CategoryGoal) {
    setEditingId(cat.id)
    setDraft(goal ? String(goal.amount) : '')
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft('')
  }

  async function saveGoal(categoryId: string) {
    const amount = parseFloat(draft.replace(',', '.'))
    if (!amount || amount <= 0) { toast('Informe um valor válido.', { type: 'error' }); return }
    setSaving(true)
    try {
      await upsert({ category_id: categoryId, amount })
      toast('Meta salva!')
      setEditingId(null)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar meta.', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function deleteGoal(categoryId: string) {
    if (!confirm('Remover meta desta categoria?')) return
    await remove(categoryId)
    toast('Meta removida.')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-1)' }}>Metas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Defina limites de gasto por categoria e acompanhe</p>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--border-md)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      ) : relevant.length === 0 ? (
        <EmptyState icon={Target} title="Sem categorias" description="Crie categorias de despesa para definir metas" />
      ) : (
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
                      <button
                        onClick={() => startEdit(cat, goal)}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/[.06]"
                        style={{ color: 'var(--text-3)' }}
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={() => deleteGoal(cat.id)}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/[.06]"
                        style={{ color: 'var(--text-3)' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ex: 500,00"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(cat.id); if (e.key === 'Escape') cancelEdit() }}
                      className="flex-1 rounded-[10px] px-3 py-2 text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                    />
                    <button
                      onClick={() => saveGoal(cat.id)}
                      disabled={saving}
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : goal ? (
                  <>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(percentage, 100)}%`, background: STATUS_COLOR[status] }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="tabular" style={{ color: 'var(--text-3)' }}>
                        {formatCurrency(spent)} de {formatCurrency(goal.amount)}
                      </span>
                      <span className="tabular font-semibold" style={{ color: STATUS_COLOR[status] }}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: STATUS_COLOR[status] }}>
                      {STATUS_LABEL[status]}
                    </span>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(cat)}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-[10px] text-[11px] font-medium transition-opacity hover:opacity-70"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                  >
                    <Target size={12} /> Definir meta
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
