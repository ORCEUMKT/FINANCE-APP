'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Tag } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { validateCategory } from '@/lib/validations'
import type { Category, CategoryInsert } from '@/types/category'

const PRESET_COLORS = [
  '#4ECCA3','#F7B731','#A29BFE','#FD79A8','#74B9FF','#55EFC4',
  '#FDCB6E','#E17055','#FFA8C5','#81ECEC','#FFD32A','#C7A0FF',
  '#FF7584','#89F2C2',
]

const PRESET_ICONS = [
  'home','utensils','car','tag','heart','gift','briefcase','book',
  'music','coffee','tree','users','file-text','shopping-bag',
]

interface FormState { name: string; color: string; icon: string; type: Category['type'] }

const DEFAULT_FORM: FormState = { name: '', color: '#A29BFE', icon: 'tag', type: 'expense' }

export default function CategoriesPage() {
  const { categories, loading, add, update, remove } = useCategories()
  const { toast } = useToast()
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState<Category | null>(null)
  const [form, setForm]           = useState<FormState>(DEFAULT_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving]       = useState(false)

  function openAdd() {
    setEditing(null); setForm(DEFAULT_FORM); setFormError(''); setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, color: cat.color, icon: cat.icon, type: cat.type })
    setFormError(''); setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateCategory(form)
    if (errs.length) { setFormError(errs[0].message); return }
    setSaving(true)
    try {
      const payload: CategoryInsert = { name: form.name.trim(), color: form.color, icon: form.icon, type: form.type }
      if (editing) {
        await update(editing.id, payload)
        toast('Categoria atualizada!')
      } else {
        await add(payload)
        toast('Categoria criada!')
      }
      setFormOpen(false)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Excluir a categoria "${cat.name}"? Os lançamentos vinculados ficarão sem categoria.`)) return
    await remove(cat.id)
    toast('Categoria excluída.')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-white">Categorias</h1>
          <p className="text-xs text-white/35 mt-0.5">{categories.length} categorias</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1.5">
          <Plus size={13} /> Nova
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : categories.length > 0 ? (
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <Card key={cat.id} className="flex items-center gap-4 px-4 py-3.5">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-900 flex-shrink-0"
                style={{ background: `${cat.color}22`, color: cat.color }}
              >
                {cat.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-700 text-white truncate">{cat.name}</div>
                <div className="text-[11px] text-white/35 mt-0.5">
                  {cat.type === 'expense' ? 'Despesa' : cat.type === 'income' ? 'Receita' : 'Ambos'}
                  {cat.is_default && ' · Padrão'}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(cat)} className="action-btn">
                  <Edit2 size={11} />
                </button>
                {!cat.is_default && (
                  <button onClick={() => handleDelete(cat)} className="action-btn !text-red-400 !border-red-500/25 !bg-red-500/[.06]">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Tag} title="Sem categorias" description="Crie sua primeira categoria" />
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nome"
            placeholder="Ex: Alimentação"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required maxLength={60}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">Tipo</label>
            <div className="flex gap-2">
              {(['expense','income','both'] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-700 border transition-all ${
                    form.type === t ? 'bg-white text-[#050506] border-white' : 'bg-white/[.04] text-white/40 border-white/10 hover:bg-white/[.08]'
                  }`}
                >
                  {t === 'expense' ? 'Despesa' : t === 'income' ? 'Receita' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">Cor</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: form.color === c ? '#fff' : 'transparent' }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color" value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
              />
              <input
                value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="bg-white/[.05] border border-white/10 rounded-xl px-3 py-2 text-sm text-white w-28 outline-none"
                placeholder="#RRGGBB"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-[2]">
              {editing ? 'Salvar' : 'Criar categoria'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
