'use client'

import { useState } from 'react'
import { ChevronDown, Edit2, Copy, CheckCircle, Trash2, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types/transaction'

interface TransactionCardProps {
  transaction: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onMarkRecovered: (id: string) => void
  rank?: number
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', recoverable: 'A Recuperar', recovered: 'Recuperado',
}

export function TransactionCard({ transaction: tx, onEdit, onDelete, onDuplicate, onMarkRecovered, rank }: TransactionCardProps) {
  const [open, setOpen] = useState(false)

  const isRecover   = tx.type === 'recover' && tx.status !== 'recovered'
  const isRecovered = tx.status === 'recovered'
  const catColor    = tx.category?.color ?? '#666'

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200',
        isRecover   ? 'border-red-500/20 bg-red-500/[.04]' :
        isRecovered ? 'border-emerald-500/20 bg-emerald-500/[.03]' :
                      'border-white/[.08] bg-gradient-to-br from-white/[.055] to-white/[.018]',
        'backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,.04)]'
      )}
    >
      {/* Main row */}
      <button
        className="w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 p-4">
          {rank !== undefined && (
            <span className="text-sm font-900 w-5 flex-shrink-0" style={{ color: ['#C9A84C','#8A8A94','#9B6A2F'][rank] ?? 'rgba(255,255,255,.2)' }}>
              #{rank + 1}
            </span>
          )}
          {/* Category dot */}
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-900"
            style={{ background: `${catColor}22`, color: catColor }}
          >
            {(tx.category?.name ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-700 text-white truncate">{tx.description}</div>
            <div className="text-[11px] text-white/40 mt-0.5 truncate">{tx.category?.name ?? 'Sem categoria'}</div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <div className={cn('text-sm font-800', isRecover ? 'text-red-400' : 'text-white')}>
              {formatCurrency(tx.value)}
            </div>
            <div className="text-[10px] text-white/35 mt-0.5">{formatDate(tx.date)}</div>
          </div>
          <ChevronDown size={14} className={cn('text-white/30 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-white/[.07] px-4 pb-4">
          <div className="grid grid-cols-2 gap-2 py-3 text-xs">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-white/30">Status</span>
              <Badge color={isRecover ? '#FF7584' : isRecovered ? '#89F2C2' : '#A29BFE'} className="mt-1">
                {STATUS_LABELS[tx.status] ?? tx.status}
              </Badge>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-widest text-white/30">Data</span>
              <p className="text-white/80 font-600 mt-1">{formatDate(tx.date)}</p>
            </div>
            {tx.notes && (
              <div className="col-span-2">
                <span className="text-[9px] uppercase tracking-widest text-white/30">Obs.</span>
                <p className="text-white/55 mt-1 leading-relaxed">{tx.notes}</p>
              </div>
            )}
            {isRecover && (
              <div className="col-span-2 rounded-xl bg-red-500/[.08] border border-red-500/[.14] p-3 text-[11px] text-red-300/80 leading-relaxed">
                {tx.notes ?? 'Lançamento a recuperar.'}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onEdit(tx)} className="action-btn">
              <Edit2 size={11} /> Editar
            </button>
            <button onClick={() => onDuplicate(tx.id)} className="action-btn">
              <Copy size={11} /> Duplicar
            </button>
            {isRecover && (
              <button onClick={() => onMarkRecovered(tx.id)} className="action-btn !text-emerald-400 !border-emerald-500/25 !bg-emerald-500/[.06]">
                <CheckCircle size={11} /> Recuperado
              </button>
            )}
            <button onClick={() => onDelete(tx.id)} className="action-btn !text-red-400 !border-red-500/25 !bg-red-500/[.06]">
              <Trash2 size={11} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
