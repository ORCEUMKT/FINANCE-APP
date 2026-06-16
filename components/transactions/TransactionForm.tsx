'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { validateTransaction, type FieldError } from '@/lib/validations'
import type { Transaction, TransactionInsert } from '@/types/transaction'
import type { VoicePrefill } from '@/lib/voiceParser'
import type { Category } from '@/types/category'

function findCategoryId(categories: Category[], name: string | null): string {
  if (!name) return ''
  const q = name.toLowerCase().trim()
  const exact = categories.find(c => c.name.toLowerCase() === q)
  if (exact) return exact.id
  const partial = categories.find(c => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()))
  if (partial) return partial.id
  return ''
}

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TransactionInsert) => Promise<void>
  categories: Category[]
  editingTransaction?: Transaction | null
  prefill?: VoicePrefill | null
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

const TYPES = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income',  label: 'Receita' },
  { value: 'recover', label: 'Recuperar' },
] as const

const STATUSES = [
  { value: 'paid',    label: 'Pago' },
  { value: 'pending', label: 'Pendente' },
] as const

export function TransactionForm({ open, onClose, onSubmit, categories, editingTransaction, prefill }: TransactionFormProps) {
  const isEdit = !!editingTransaction

  const [description, setDescription]   = useState('')
  const [value, setValue]               = useState('')
  const [date, setDate]                 = useState('')
  const [categoryId, setCategoryId]     = useState<string>('')
  const [type, setType]                 = useState<'expense' | 'income' | 'recover'>('expense')
  const [status, setStatus]             = useState<'paid' | 'pending' | 'recoverable'>('paid')
  const [notes, setNotes]               = useState('')
  const [installments, setInstallments] = useState(1)
  const [errors, setErrors]             = useState<FieldError[]>([])
  const [loading, setLoading]           = useState(false)

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
        setInstallments(1)
      } else {
        setDescription(prefill?.description ?? '')
        setValue(prefill?.value ? String(prefill.value) : '')
        setDate(prefill?.date ?? new Date().toISOString().slice(0, 10))
        setType((prefill?.type as 'expense' | 'income' | 'recover') ?? 'expense')
        setStatus((prefill?.status as 'paid' | 'pending') ?? 'paid')
        setNotes(prefill?.notes ?? '')
        setInstallments(prefill?.installments ?? 1)
        const catId = prefill?.category_name
          ? findCategoryId(categories, prefill.category_name)
          : (categories[0]?.id ?? '')
        setCategoryId(catId)
      }
      setErrors([])
    }
  }, [open, editingTransaction, categories, prefill])

  const fieldError = (field: string) => errors.find((e) => e.field === field)?.message

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateTransaction({ description, value, date, category_id: categoryId })
    if (errs.length) { setErrors(errs); return }
    setLoading(true)
    try {
      const n = !isEdit && installments > 1 ? installments : 1
      for (let i = 0; i < n; i++) {
        await onSubmit({
          description: n > 1 ? `${description.trim()} (${i + 1}/${n})` : description.trim(),
          value: parseFloat(value),
          date: addMonths(date, i),
          category_id: categoryId || null,
          type,
          status: type === 'recover' ? 'recoverable' : status,
          notes: notes.trim() || null,
        })
      }
      onClose()
    } catch (err: unknown) {
      setErrors([{ field: 'form', message: err instanceof Error ? err.message : 'Erro ao salvar.' }])
    } finally {
      setLoading(false)
    }
  }

  const segBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
    color: active ? 'var(--accent-text)' : 'var(--text-3)',
    cursor: 'pointer',
    transition: 'all .15s',
    fontFamily: 'inherit',
  })

  const fieldLabel = (text: string) => (
    <label className="text-[10px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
      {text}
    </label>
  )

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Lançamento' : 'Novo Lançamento'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {/* Voice detection banner */}
        {!isEdit && prefill?.rawText && (
          <div
            className="flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[11px]"
            style={{ background: 'rgba(230,229,216,0.08)', border: '1px solid rgba(230,229,216,0.18)', color: 'var(--text-2)' }}
          >
            <span className="text-base leading-none mt-0.5">🎤</span>
            <span>
              <span style={{ color: 'var(--text-3)' }}>Detectado: </span>
              <em style={{ color: 'var(--text-1)', fontStyle: 'normal', fontWeight: 500 }}>&quot;{prefill.rawText}&quot;</em>
              <span style={{ color: 'var(--text-3)' }}> — revise e confirme</span>
            </span>
          </div>
        )}
        <Input
          label="Descrição"
          placeholder="Ex: Almoço com clientes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldError('description')}
          maxLength={120}
        />

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={fieldError('value')}
            />
          </div>
          <div className="min-w-0 overflow-hidden">
            <Input
              label="Data"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={fieldError('date')}
            />
          </div>
        </div>

        {/* Parcelas — somente para novos lançamentos */}
        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            {fieldLabel('Parcelas')}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center rounded-[12px] overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}
              >
                <button
                  type="button"
                  onClick={() => setInstallments(Math.max(1, installments - 1))}
                  className="w-9 h-9 flex items-center justify-center transition-colors hover:bg-white/[.06]"
                  style={{ color: 'var(--text-3)', borderRight: '1px solid var(--border)' }}
                >
                  <Minus size={13} />
                </button>
                <span
                  className="w-10 h-9 flex items-center justify-center text-sm font-semibold tabular"
                  style={{ color: 'var(--text-1)' }}
                >
                  {installments}
                </span>
                <button
                  type="button"
                  onClick={() => setInstallments(Math.min(60, installments + 1))}
                  className="w-9 h-9 flex items-center justify-center transition-colors hover:bg-white/[.06]"
                  style={{ color: 'var(--text-3)', borderLeft: '1px solid var(--border)' }}
                >
                  <Plus size={13} />
                </button>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {installments === 1 ? 'à vista' : `${installments}× parcelado (+1 mês/parcela)`}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {fieldLabel('Categoria')}
          <div className="relative">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-[12px] px-4 py-2 pr-9 text-sm outline-none appearance-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                color: 'var(--text-1)',
                fontFamily: 'inherit',
              }}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-3)' }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {fieldLabel('Tipo')}
          <div className="flex gap-2">
            {TYPES.map(({ value: t, label }) => (
              <button key={t} type="button" onClick={() => setType(t)} style={segBtnStyle(type === t)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {type !== 'recover' && (
          <div className="flex flex-col gap-1.5">
            {fieldLabel('Status')}
            <div className="flex gap-2">
              {STATUSES.map(({ value: s, label }) => (
                <button key={s} type="button" onClick={() => setStatus(s)} style={segBtnStyle(status === s)}>
                  {label}
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

        {fieldError('form') && (
          <p className="text-xs -mt-1" style={{ color: 'var(--red)' }}>{fieldError('form')}</p>
        )}

        <div className="flex gap-3 pt-0.5">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-[2]">
            {isEdit
              ? 'Salvar alterações'
              : installments > 1
              ? `Criar ${installments} parcelas`
              : 'Adicionar lançamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
