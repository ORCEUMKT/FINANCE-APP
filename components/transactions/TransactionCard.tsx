'use client'

import { useState, memo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

const ACTION_W = 76

function InstallmentDeleteDialog({
  tx, installmentTotal, onSingle, onGroup, onClose,
}: {
  tx: Transaction; installmentTotal: number; onSingle: () => void; onGroup: () => void; onClose: () => void
}) {
  const baseName = tx.description.replace(/\s*\(\d+\/\d+\)$/, '')
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-[20px] p-5 flex flex-col gap-4"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-md)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Excluir parcelamento</p>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{baseName}</span> é um parcelamento em {installmentTotal}x. O que deseja excluir?
          </p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={onSingle} className="flex-1 py-2.5 rounded-[12px] text-[12px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-md)', color: 'var(--text-1)' }}>
            Só esta parcela
          </button>
          <button onClick={onGroup} className="flex-1 py-2.5 rounded-[12px] text-[12px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.28)', color: '#f87171' }}>
            Todas as {installmentTotal}
          </button>
        </div>
        <button onClick={onClose} className="text-[11px] text-center hover:opacity-70 transition-opacity" style={{ color: 'var(--text-3)' }}>
          Cancelar
        </button>
      </div>
    </div>,
    document.body,
  )
}

export const TransactionCard = memo(function TransactionCard({
  transaction: tx, onEdit, onDelete, onDeleteGroup, onDuplicate, onMarkRecovered, rank,
}: TransactionCardProps) {
  const [open, setOpen]               = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)

  const wrapperRef      = useRef<HTMLDivElement>(null)
  const contentRef      = useRef<HTMLDivElement>(null)
  const suppressClick   = useRef(false)

  const isRecover   = tx.type === 'recover' && tx.status !== 'recovered'
  const isRecovered = tx.status === 'recovered'
  const catColor    = tx.category?.color ?? 'var(--text-3)'
  const installment = parseInstallment(tx.description)

  const cardStyle: React.CSSProperties = {
    background: isRecover ? 'rgba(248,113,113,0.03)' : isRecovered ? 'rgba(62,207,142,0.02)' : 'var(--surface)',
    border: `1px solid ${isRecover ? 'rgba(248,113,113,0.10)' : isRecovered ? 'rgba(62,207,142,0.08)' : 'var(--border)'}`,
    boxShadow: 'var(--shadow-card)',
  }

  // Reset swipe when card expands
  useEffect(() => {
    if (open) snapTo(0)
  }, [open]) // eslint-disable-line

  function snapTo(offset: number) {
    const el = contentRef.current
    if (!el) return
    el.style.transition = 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)'
    el.style.transform  = `translateX(${offset}px)`
    setSwipeOffset(offset)
  }

  // Non-passive touch listeners for smooth swipe + scroll prevention
  useEffect(() => {
    const wrapper = wrapperRef.current
    const content = contentRef.current
    if (!wrapper || !content) return

    let startX = 0, startY = 0, startOffset = 0
    let dragging = false, isHoriz = false

    function getOffset() {
      const m = content!.style.transform.match(/translateX\((-?[\d.]+)px\)/)
      return m ? parseFloat(m[1]) : 0
    }

    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startOffset = getOffset()
      dragging = true
      isHoriz = false
    }

    function onMove(e: TouchEvent) {
      if (!dragging) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      if (!isHoriz) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        if (Math.abs(dy) >= Math.abs(dx)) { dragging = false; return }
        isHoriz = true
      }

      e.preventDefault()
      const next = Math.min(0, Math.max(startOffset + dx, -ACTION_W))
      content!.style.transition = 'none'
      content!.style.transform  = `translateX(${next}px)`
    }

    function onEnd() {
      if (!isHoriz) { dragging = false; return }
      dragging = false
      suppressClick.current = true
      setTimeout(() => { suppressClick.current = false }, 350)

      const cur = getOffset()
      const snap = cur < -ACTION_W / 2 ? -ACTION_W : 0
      content!.style.transition = 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)'
      content!.style.transform  = `translateX(${snap}px)`
      setSwipeOffset(snap)
    }

    wrapper.addEventListener('touchstart', onStart,  { passive: true  })
    wrapper.addEventListener('touchmove',  onMove,   { passive: false })
    wrapper.addEventListener('touchend',   onEnd,    { passive: true  })
    return () => {
      wrapper.removeEventListener('touchstart', onStart)
      wrapper.removeEventListener('touchmove',  onMove)
      wrapper.removeEventListener('touchend',   onEnd)
    }
  }, [])

  function handleDeleteClick() {
    if (installment) setDeleteDialog(true)
    else onDelete(tx.id)
  }

  function handleSwipeDelete() {
    snapTo(0)
    handleDeleteClick()
  }

  function handleToggle() {
    if (suppressClick.current) return
    if (swipeOffset < 0) { snapTo(0); return }
    setOpen(v => !v)
  }

  return (
    <>
      {/* Swipe wrapper — carries the card style so the gap on swipe blends with the card bg */}
      <div ref={wrapperRef} className="relative overflow-hidden rounded-[16px]" style={{ ...cardStyle }}>

        {/* Delete action revealed on swipe */}
        <div
          className="absolute top-0 right-0 bottom-0 flex flex-col items-center justify-center gap-1"
          style={{ width: ACTION_W, background: '#ef4444' }}
        >
          <Trash2 size={20} color="white" />
          <span className="text-[9px] font-bold text-white uppercase tracking-wide">Excluir</span>
          <button className="absolute inset-0" onClick={handleSwipeDelete} aria-label="Excluir lançamento" />
        </div>

        {/* Sliding card content — no border/shadow (wrapper provides them) */}
        <div ref={contentRef} className="relative z-[1] rounded-[16px]" style={{ background: cardStyle.background, willChange: 'transform' }}>
          <button className="w-full text-left" onClick={handleToggle}>
            <div className="flex items-center gap-3 p-4">
              {rank !== undefined && (
                <span className="text-[10px] font-semibold w-4 flex-shrink-0 tabular"
                  style={{ color: ['#c9a84c','#555565','#6b4a20'][rank] ?? 'var(--text-3)' }}>
                  {rank + 1}
                </span>
              )}

              <span className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 text-[11px] font-semibold"
                style={{ background: `${catColor}15`, color: catColor }}>
                {(tx.category?.name ?? '?').charAt(0).toUpperCase()}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{tx.description}</div>
                <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>{tx.category?.name ?? 'Sem categoria'}</div>
              </div>

              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-[13px] font-semibold tabular" style={{ color: isRecover ? '#f87171' : 'var(--text-1)' }}>
                  {formatCurrency(tx.value)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{formatDate(tx.date)}</div>
              </div>

              <ChevronDown size={12}
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
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => onEdit(tx)} className="action-btn"><Edit2 size={11} /> Editar</button>
                <button onClick={() => onDuplicate(tx.id)} className="action-btn"><Copy size={11} /> Duplicar</button>
                {isRecover && (
                  <button onClick={() => onMarkRecovered(tx.id)} className="action-btn"
                    style={{ color: '#3ecf8e', borderColor: 'rgba(62,207,142,0.15)', background: 'rgba(62,207,142,0.05)' }}>
                    <CheckCircle size={11} /> Recuperado
                  </button>
                )}
                <button onClick={handleDeleteClick} className="action-btn hidden lg:flex"
                  style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.04)' }}>
                  <Trash2 size={11} /> Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteDialog && installment && (
        <InstallmentDeleteDialog
          tx={tx}
          installmentTotal={installment.total}
          onSingle={() => { onDelete(tx.id); setDeleteDialog(false); setOpen(false) }}
          onGroup={() => { onDeleteGroup(tx); setDeleteDialog(false); setOpen(false) }}
          onClose={() => setDeleteDialog(false)}
        />
      )}
    </>
  )
})
