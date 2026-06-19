'use client'

import { useState, useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { MonthPicker, monthRange, currentMonth, type MonthValue } from '@/components/ui/MonthPicker'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatters'

type ABCClass = 'A' | 'B' | 'C'
type TxType = 'expense' | 'income'

const CLASS_COLOR: Record<ABCClass, string> = {
  A: 'var(--green)',
  B: 'var(--orange)',
  C: 'var(--text-3)',
}
const CLASS_BG: Record<ABCClass, string> = {
  A: 'rgba(62,207,142,0.12)',
  B: 'rgba(245,158,66,0.12)',
  C: 'rgba(136,136,152,0.10)',
}
const CLASS_BORDER: Record<ABCClass, string> = {
  A: 'rgba(62,207,142,0.28)',
  B: 'rgba(245,158,66,0.28)',
  C: 'rgba(136,136,152,0.22)',
}
const CLASS_LABEL: Record<ABCClass, string> = { A: '0 – 80%', B: '80 – 95%', C: '95 – 100%' }
const CLASS_DESC: Record<ABCClass, string> = {
  A: 'Alta prioridade',
  B: 'Média prioridade',
  C: 'Baixa prioridade',
}

function useABC(transactions: ReturnType<typeof useTransactions>['transactions']) {
  return useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number; count: number }>()

    transactions.forEach((tx) => {
      const key = tx.category_id ?? '__none__'
      const existing = map.get(key)
      if (existing) { existing.total += tx.value; existing.count++ }
      else map.set(key, {
        name: tx.category?.name ?? 'Sem categoria',
        color: tx.category?.color ?? '#666',
        total: tx.value,
        count: 1,
      })
    })

    const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total)
    const grandTotal = sorted.reduce((s, c) => s + c.total, 0)

    let cumulative = 0
    const items = sorted.map((c, index) => {
      const pct = grandTotal > 0 ? (c.total / grandTotal) * 100 : 0
      cumulative += pct
      const cls: ABCClass = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C'
      return { ...c, index, pct, cumulative, cls }
    })

    const summary: Record<ABCClass, { count: number; total: number }> = {
      A: { count: 0, total: 0 },
      B: { count: 0, total: 0 },
      C: { count: 0, total: 0 },
    }
    items.forEach((item) => { summary[item.cls].count++; summary[item.cls].total += item.total })

    return { items, grandTotal, summary }
  }, [transactions])
}

export default function ABCPage() {
  const [selectedMonth, setSelectedMonth] = useState<MonthValue>(currentMonth())
  const [activeType, setActiveType] = useState<TxType>('expense')
  const { dateFrom, dateTo } = monthRange(selectedMonth)

  const { transactions: expenseTxs, loading: loadingExp } = useTransactions({
    date_from: dateFrom, date_to: dateTo, type: 'expense',
  })
  const { transactions: incomeTxs, loading: loadingInc } = useTransactions({
    date_from: dateFrom, date_to: dateTo, type: 'income',
  })

  const expenseABC = useABC(expenseTxs)
  const incomeABC  = useABC(incomeTxs)

  const { items, grandTotal, summary } = activeType === 'expense' ? expenseABC : incomeABC
  const loading = activeType === 'expense' ? loadingExp : loadingInc

  const pctA = grandTotal > 0 ? (summary.A.total / grandTotal) * 100 : 0
  const pctB = grandTotal > 0 ? (summary.B.total / grandTotal) * 100 : 0
  const pctC = grandTotal > 0 ? (summary.C.total / grandTotal) * 100 : 0

  const segStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 0',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 600,
    border: active ? '1px solid var(--accent)' : '1px solid transparent',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--text-3)',
    cursor: 'pointer',
    transition: 'all .15s',
    fontFamily: 'inherit',
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-1)' }}>Curva ABC</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Análise de Pareto por categoria
          </p>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Type toggle */}
      <div
        className="flex gap-1 p-1 rounded-[14px]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <button onClick={() => setActiveType('expense')} style={segStyle(activeType === 'expense')}>
          Despesas
        </button>
        <button onClick={() => setActiveType('income')} style={segStyle(activeType === 'income')}>
          Receitas
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--border-md)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={`Sem ${activeType === 'expense' ? 'despesas' : 'receitas'}`}
          description={`Adicione ${activeType === 'expense' ? 'despesas' : 'receitas'} para ver a Curva ABC`}
        />
      ) : (
        <>
          {/* Pareto bar */}
          <Card className="p-4 flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
              Distribuição Pareto
            </p>
            <div className="flex h-7 rounded-[10px] overflow-hidden gap-px">
              {pctA > 0 && (
                <div
                  className="flex items-center justify-center text-[11px] font-bold transition-all"
                  style={{ width: `${pctA}%`, background: 'var(--green)', color: '#fff' }}
                >
                  {pctA >= 6 ? 'A' : ''}
                </div>
              )}
              {pctB > 0 && (
                <div
                  className="flex items-center justify-center text-[11px] font-bold transition-all"
                  style={{ width: `${pctB}%`, background: 'var(--orange)', color: '#fff' }}
                >
                  {pctB >= 6 ? 'B' : ''}
                </div>
              )}
              {pctC > 0 && (
                <div
                  className="flex items-center justify-center text-[11px] font-bold transition-all"
                  style={{ width: `${pctC}%`, background: 'rgba(136,136,152,0.35)', color: 'var(--text-2)' }}
                >
                  {pctC >= 6 ? 'C' : ''}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-5">
              {(['A', 'B', 'C'] as ABCClass[]).map((cls) => (
                <div key={cls} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CLASS_COLOR[cls] }} />
                  <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                    Classe {cls} · {CLASS_LABEL[cls]}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            {(['A', 'B', 'C'] as ABCClass[]).map((cls) => (
              <Card key={cls} className="p-3 flex flex-col gap-2">
                {/* Letter badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[11px] font-bold flex-shrink-0"
                    style={{
                      background: CLASS_BG[cls],
                      border: `1px solid ${CLASS_BORDER[cls]}`,
                      color: CLASS_COLOR[cls],
                    }}
                  >
                    {cls}
                  </span>
                  <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: CLASS_COLOR[cls] }}>
                    Classe {cls}
                  </span>
                </div>
                <p className="text-[13px] font-bold tabular leading-tight" style={{ color: 'var(--text-1)' }}>
                  {formatCurrency(summary[cls].total)}
                </p>
                <p className="text-[10px] tabular" style={{ color: 'var(--text-3)' }}>
                  {summary[cls].count} {summary[cls].count === 1 ? 'categoria' : 'categorias'}
                </p>
              </Card>
            ))}
          </div>

          {/* Ranked list */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-[2px]" style={{ color: 'var(--text-3)' }}>
                Ranking · {formatCurrency(grandTotal)} em {activeType === 'expense' ? 'despesas' : 'receitas'}
              </p>
            </div>

            <div
              className="hidden sm:grid px-4 py-2 text-[9px] font-semibold uppercase tracking-[1.5px]"
              style={{
                gridTemplateColumns: '24px 1fr 96px 120px 56px 56px 28px',
                color: 'var(--text-3)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span>#</span>
              <span>Categoria</span>
              <span className="text-right">Valor</span>
              <span className="px-2">Participação</span>
              <span className="text-right">%</span>
              <span className="text-right">∑%</span>
              <span className="text-center">Cls</span>
            </div>

            <div className="flex flex-col">
              {items.map((item, i) => (
                <div
                  key={item.name + i}
                  className="flex sm:grid items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[.02]"
                  style={{
                    gridTemplateColumns: '24px 1fr 96px 120px 56px 56px 28px',
                    borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span
                    className="w-5 sm:w-auto text-[11px] font-semibold tabular text-right flex-shrink-0"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {i + 1}
                  </span>

                  <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
                      {item.name}
                    </span>
                  </div>

                  <span
                    className="hidden sm:block text-[12px] font-semibold tabular text-right"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {formatCurrency(item.total)}
                  </span>

                  <div className="hidden sm:flex items-center px-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${item.pct}%`, background: CLASS_COLOR[item.cls] }}
                      />
                    </div>
                  </div>

                  <span className="hidden sm:block text-[11px] tabular text-right" style={{ color: 'var(--text-2)' }}>
                    {item.pct.toFixed(1)}%
                  </span>

                  <span className="hidden sm:block text-[11px] tabular text-right" style={{ color: 'var(--text-3)' }}>
                    {item.cumulative.toFixed(0)}%
                  </span>

                  <span
                    className="sm:hidden text-[12px] font-semibold tabular ml-auto flex-shrink-0"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {formatCurrency(item.total)}
                  </span>

                  <span
                    className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: CLASS_BG[item.cls],
                      border: `1px solid ${CLASS_BORDER[item.cls]}`,
                      color: CLASS_COLOR[item.cls],
                    }}
                  >
                    {item.cls}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
