'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Tag, Target } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { useGoals } from '@/hooks/useGoals'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { validateCategory } from '@/lib/validations'
import { formatCurrency } from '@/lib/formatters'
import type { Category, CategoryInsert } from '@/types/category'
import type { CategoryGoal } from '@/types/goal'

const PRESET_COLORS = [
  '#f87171', // Vermelho     — var(--red)
  '#fb923c', // Laranja
  '#fbbf24', // Âmbar
  '#3ecf8e', // Verde        — var(--green)
  '#34d399', // Esmeralda
  '#2dd4bf', // Teal
  '#22d3ee', // Ciano
  '#60a5fa', // Azul         — var(--blue)
  '#818cf8', // Índigo
  '#a78bfa', // Violeta
  '#c084fc', // Roxo
  '#f472b6', // Rosa
  '#fb7185', // Crimson
  '#a3e635', // Lima
]

interface FormState { name: string; color: string; icon: string; type: Category['type']; goal: string }
const DEFAULT_FORM: FormState = { name: '', color: '#a78bfa', icon: 'tag', type: 'expense', goal: '' }

const TYPE_LABEL: Record<Category['type'], string> = { expense: 'Despesa', income: 'Receita', both: 'Ambos' }
const TYPE_COLOR: Record<Category['type'], string> = { expense: 'var(--red)', income: 'var(--green)', both: 'var(--blue)' }

const segBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 0', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
  color: active ? '#fff' : 'var(--text-3)', cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
})

export default function CategoriesPage() {
  const { categories, loading, add, update, remove } = useCategories()
  const { goals, upsert: upsertGoal, remove: removeGoal } = useGoals()
  const { toast } = useToast()
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState<Category | null>(null)
  const [form, setForm]           = useState<FormState>(DEFAULT_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)

  function goalFor(categoryId: string): CategoryGoal | undefined {
    return goals.find((g) => g.category_id === categoryId)
  }

  function openAdd() {
    setEditing(null); setForm(DEFAULT_FORM); setFormError(''); setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    const existingGoal = goalFor(cat.id)
    setForm({ name: cat.name, color: cat.color, icon: cat.icon, type: cat.type, goal: existingGoal ? String(existingGoal.amount) : '' })
    setFormError(''); setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateCategory(form)
    if (errs.length) { setFormError(errs[0].message); return }
    setSaving(true)
    try {
      const payload: CategoryInsert = { name: form.name.trim(), color: form.color, icon: form.icon, type: form.type }
      const goalAmount = parseFloat(form.goal)
      let categoryId = editing?.id
      if (editing) {
        await update(editing.id, payload)
        toast('Categoria atualizada!')
      } else {
        const created = await add(payload)
        categoryId = created.id
        toast('Categoria criada!')
      }
      if (categoryId) {
        if (form.goal && goalAmount > 0) {
          await upsertGoal({ category_id: categoryId, amount: goalAmount })
        } else if (editing && goalFor(editing.id)) {
          await removeGoal(editing.id)
        }
      }
      setFormOpen(false)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Excluir "${cat.name}"?\n\nLançamentos vinculados ficarão sem categoria.`)) return
    setDeleting(cat.id)
    try {
      await remove(cat.id)
      toast('Categoria excluída.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-1)' }}>Categorias</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Gerencie suas categorias</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1.5">
          <Plus size={13} /> Nova
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--border-md)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sem categorias"
          description="Crie categorias para organizar seus lançamentos"
        />
      ) : (
        <>
          <p className="text-xs -mt-3" style={{ color: 'var(--text-3)' }}>
            {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                goal={goalFor(cat.id)}
                isDeleting={deleting === cat.id}
                onEdit={() => openEdit(cat)}
                onDelete={() => handleDelete(cat)}
              />
            ))}
          </div>
        </>
      )}

      {/* Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nome"
            placeholder="Ex: Alimentação"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            maxLength={60}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
              Tipo
            </label>
            <div className="flex gap-2">
              {(['expense', 'income', 'both'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))} style={segBtnStyle(form.type === t)}>
                  {t === 'expense' ? 'Despesa' : t === 'income' ? 'Receita' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: form.color === c ? '#fff' : 'transparent' }}
                />
              ))}
            </div>
            {/* Preview + hex input */}
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-8 h-8 rounded-[10px] flex-shrink-0"
                style={{ background: form.color, boxShadow: `0 0 12px ${form.color}55` }}
              />
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded-lg cursor-pointer opacity-0 absolute"
              />
              <input
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm w-28 outline-none font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                placeholder="#RRGGBB"
              />
            </div>
          </div>
          <Input
            label="Meta mensal (opcional)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Ex: 500,00"
            value={form.goal}
            onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
          />
          {formError && <p className="text-xs" style={{ color: 'var(--red)' }}>{formError}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="flex-[2]">
              {editing ? 'Salvar' : 'Criar categoria'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function CategoryCard({
  cat, goal, isDeleting, onEdit, onDelete,
}: {
  cat: Category
  goal?: CategoryGoal
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="relative rounded-[16px] p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(18,18,28,0.55)',
        border: '1px solid rgba(255,255,255,0.09)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Color dot + name + type */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}55` }}
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>
            {cat.name}
          </div>
          <span className="text-[10px] font-medium" style={{ color: TYPE_COLOR[cat.type] }}>
            {TYPE_LABEL[cat.type]}
          </span>
        </div>
      </div>

      {goal && (
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-3)' }}>
          <Target size={10} />
          Meta: {formatCurrency(goal.amount)}
        </div>
      )}

      {/* Action buttons — sempre visíveis */}
      <div className="flex gap-1.5">
        <button
          onClick={onEdit}
          className="flex-1 h-7 rounded-[8px] flex items-center justify-center gap-1.5 text-[10px] font-medium transition-opacity hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          <Edit2 size={10} /> Editar
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex-1 h-7 rounded-[8px] flex items-center justify-center gap-1.5 text-[10px] font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }}
        >
          <Trash2 size={10} /> Excluir
        </button>
      </div>
    </div>
  )
}
