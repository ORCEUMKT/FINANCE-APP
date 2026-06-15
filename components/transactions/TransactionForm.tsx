'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { validateTransaction, type FieldError } from '@/lib/validations'
import type { Transaction, TransactionInsert } from '@/types/transaction'
import type { Category } from '@/types/category'

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TransactionInsert) => Promise<void>
  categories: Category[]
  editingTransaction?: Transaction | null
}

export function TransactionForm({ open, onClose, onSubmit, categories, editingTransaction }: TransactionFormProps) {
  const isEdit = !!editingTransaction

  const [description, setDescription] = useState('')
  const [value, setValue]             = useState('')
  const [date, setDate]               = useState('')
  const [categoryId, setCategoryId]   = useState<string>('')
  const [type, setType]               = useState<'expense' | 'income' | 'recover'>('expense')
  const [status, setStatus]           = useState<'paid' | 'pending' | 'recoverable'>('paid')
  const [notes, setNotes]             = useState('')
  const [errors, setErrors]           = useState<FieldError[]>([])
  const [loading, setLoading]         = useState(false)

  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        setDescription(editingTransaction.description)
        setValue(String(editingTransaction.value))
        setDate(editingTransaction.date)
        setCategoryId(editingTransaction.category_id ?? '')
        setType(editingTransaction.type as 'expense' | 'income' | 'recover')
        setStatus(editingTransaction.status as 'paid' | 'pending' | 'recoverable')
        setNotes(editingTransaction.notes ?? '')
      } else {
        setDescription(''); setValue(''); setDate(new Date().toISOString().slice(0, 10))
        setCategoryId(categories[0]?.id ?? ''); setType('expense'); setStatus('paid'); setNotes('')
      }
      setErrors([])
    }
  }, [open, editingTransaction, categories])

  const fieldError = (field: string) => errors.find((e) => e.field === field)?.message

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateTransaction({ description, value, date, category_id: categoryId })
    if (errs.length) { setErrors(errs); return }
    setLoading(true)
    try {
      await onSubmit({
        description: description.trim(),
        value: parseFloat(value),
        date,
        category_id: categoryId || null,
        type,
        status: type === 'recover' ? 'recoverable' : status,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err: unknown) {
      setErrors([{ field: 'form', message: err instanceof Error ? err.message : 'Erro ao salvar.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Lançamento' : 'Novo Lançamento'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Descrição"
          placeholder="Ex: Almoço com clientes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldError('description')}
          maxLength={120}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={fieldError('value')}
            className="text-emerald-400 font-800"
          />
          <Input
            label="Data"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={fieldError('date')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-white/[.055] border border-white/10 rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:border-white/25"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">Tipo</label>
          <div className="flex gap-2">
            {(['expense','income','recover'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-700 border transition-all ${
                  type === t
                    ? 'bg-white text-[#050506] border-white'
                    : 'bg-white/[.04] text-white/40 border-white/10 hover:bg-white/[.08]'
                }`}
              >
                {t === 'expense' ? 'Despesa' : t === 'income' ? 'Receita' : 'Recuperar'}
              </button>
            ))}
          </div>
        </div>
        {type !== 'recover' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-700 uppercase tracking-[2px] text-white/40">Status</label>
            <div className="flex gap-2">
              {(['paid','pending'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-700 border transition-all ${
                    status === s
                      ? 'bg-white text-[#050506] border-white'
                      : 'bg-white/[.04] text-white/40 border-white/10 hover:bg-white/[.08]'
                  }`}
                >
                  {s === 'paid' ? 'Pago' : 'Pendente'}
                </button>
              ))}
            </div>
          </div>
        )}
        <Input
          label="Observações (opcional)"
          placeholder="Notas adicionais…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={200}
        />
        {fieldError('form') && <p className="text-xs text-red-400 -mt-1">{fieldError('form')}</p>}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-[2]">
            {isEdit ? 'Salvar alterações' : 'Adicionar lançamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
