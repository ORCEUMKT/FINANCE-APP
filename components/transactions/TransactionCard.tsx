'use client'

import { useState, memo } from 'react'
import { ChevronDown, Edit2, Copy, CheckCircle, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { parseInstallment } from '@/lib/installments'
import type { Transaction } from '@/types/transaction'

interface TransactionCardProps {
  transaction: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => void
  onDeleteGroup: (tx: Transaction) => void
  onDuplicate: (id: string) => void
  onMarkRecovered: (id: string) => void
  rank?: number
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', recoverable: 'A Recuperar', recovered: 'Recuperado',
}

export const TransactionCard = memo(function TransactionCard({
  transaction: tx, onEdit, onDelete, onDeleteGroup, onDuplicate, onMarkRecovered, rank,
}: TransactionCardProps) {
  const [open, setOpen] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)

  const isRecover   = tx.type === 'recover' && tx.status !== 'recovered'
  const isRecovered = tx.status === 'recovered'
  const catColor    = tx.category?.color ?? 'var(--text-3)'
  const installment = parseInstallment(tx.description)

  const cardStyle: React.CSSProperties = {
    background: isRecover ? 'rgba(248,113,113,0.03)' : isRecovered ? 'rgba(62,207,142,0.02)' : 'var(--surface)',
    border: `1px solid ${isRecover ? 'rgba(248,113,113,0.10)' : isRecovered ? 'rgba(62,207,142,0.08)' : 'var(--border)'}`,
    boxShadow: 'var(--shadow-card)',
  }

  function handleDeleteClick() {
    if (installment) {
      setDeleteMode(true)
    } else {
      onDelete(tx.id)
    }
  }

  return (
    <div className="rounded-[16px] transition-all duration-150" style={cardStyle}>
      <button className="w-full text-left" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3 p-4">
          {rank !== undefined && (
            <span
              className="text-[10px] font-semibold w-4 flex-shrink-0 tabular"
              style={{ color: ['#c9a84c','#555565','#6b4a20'][rank] ?? 'var(--text-3)' }}
            >
              {rank + 1}
            </span>
          )}

          <span
            className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 text-[11px] font-semibold"
            style={{ background: `${catColor}15`, color: catColor }}
          >
            {(tx.category?.name ?? '?').charAt(0).toUpperCase()}
          </span>

          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
              {tx.description}
            </div>
            <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
              {tx.category?.name ?? 'Sem categoria'}
            </div>
          </div>

          <div className="text-right flex-shrink-0 ml-2">
            <div className="text-[13px] font-semibold tabular" style={{ color: isRecover ? '#f87171' : 'var(--text-1)' }}>
              {formatCurrency(tx.value)}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
              {formatDate(tx.date)}
            </div>
          </div>

          <ChevronDown
            size={12}
            className={cn('flex-shrink-0 transition-transform duration-200', open && 'rotate-180')}
            style={{ color: 'var(--text-3)' }}
          />
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }} className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3 py-3">
            <div>
              <span className="text-[9px] uppercase tracking-[1.5px]" style={{ color: 'var(--text-3)' }}>Status</span>
              <div className="mt-1.5">
                <Badge color={isRecover ? '#f87171' : isRecovered ? '#3ecf8e' : '#e6e5d8'}>
                  {STATUS_LABELS[tx.status] ?? tx.status}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-[1.5px]" style={{ color: 'var(--text-3)' }}>Data</span>
              <p className="text-[12px] font-medium mt-1.5" style={{ color: 'var(--text-2)' }}>{formatDate(tx.date)}</p>
            </div>
            {tx.notes && (
              <div className="col-span-2">
                <span className="text-[9px] uppercase tracking-[1.5px]" style={{ color: 'var(--text-3)' }}>Obs.</span>
                <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{tx.notes}</p>
              </div>
            )}
          </div>

          {deleteMode && installment ? (
            <div
              className="flex flex-col gap-2.5 p-3 rounded-[12px]"
              style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.18)' }}
            >
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                <span style={{ color: '#f87171', fontWeight: 600 }}>{tx.description}</span> é parte de um parcelamento em {installment.total}x.
              </p>
              <div className="flex gap-2">
                <button
                  className="action-btn flex-1 justify-center"
                  onClick={() => { onDelete(tx.id); setDeleteMode(false); setOpen(false) }}
                >
                  Só esta parcela
                </button>
                <button
                  className="action-btn flex-1 justify-center"
                  style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)' }}
                  onClick={() => { onDeleteGroup(tx); setDeleteMode(false); setOpen(false) }}
                >
                  Todas as {installment.total}
                </button>
              </div>
              <button
                onClick={() => setDeleteMode(false)}
                className="text-[10px] text-center hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-3)' }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => onEdit(tx)} className="action-btn"><Edit2 size={11} /> Editar</button>
              <button onClick={() => onDuplicate(tx.id)} className="action-btn"><Copy size={11} /> Duplicar</button>
              {isRecover && (
                <button onClick={() => onMarkRecovered(tx.id)} className="action-btn"
                  style={{ color: '#3ecf8e', borderColor: 'rgba(62,207,142,0.15)', background: 'rgba(62,207,142,0.05)' }}>
                  <CheckCircle size={11} /> Recuperado
                </button>
              )}
              <button onClick={handleDeleteClick} className="action-btn"
                style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.04)' }}>
                <Trash2 size={11} /> Excluir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
