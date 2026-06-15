'use client'

import { useRouter } from 'next/navigation'
import { TrendingDown, TrendingUp, RotateCcw, Activity, Plus } from 'lucide-react'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DonutChart } from '@/components/dashboard/DonutChart'
import { BarChart } from '@/components/dashboard/BarChart'
import { TransactionCard } from '@/components/transactions/TransactionCard'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/formatters'
import type { Transaction } from '@/types/transaction'

export default function DashboardPage() {
  const { metrics, loading } = useDashboardMetrics()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-white">Dashboard</h1>
          <p className="text-xs text-white/35 mt-0.5">Visão geral das suas finanças</p>
        </div>
        <Button onClick={() => router.push('/transactions')} size="sm" className="gap-1.5">
          <Plus size={13} /> Lançamento
        </Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Despesas" value={metrics.totalExpenses} icon={TrendingDown} color="#FF7584"
          trend={`${metrics.transactionCount} lançamentos`} />
        <MetricCard label="Total Receitas"  value={metrics.totalIncome}   icon={TrendingUp}  color="#89F2C2" />
        <MetricCard label="Saldo Líquido"   value={metrics.liquidTotal}   icon={Activity}    color="#74B9FF"
          trend={metrics.liquidTotal >= 0 ? 'Positivo' : 'Negativo'} />
        {metrics.totalRecover > 0 && (
          <MetricCard label="A Recuperar"   value={metrics.totalRecover}  icon={RotateCcw}   color="#FFD36B" />
        )}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-[10px] font-800 uppercase tracking-[2.5px] text-white/40 mb-4">Composição</h2>
          <DonutChart
            data={metrics.categoryRanking}
            total={metrics.totalExpenses + metrics.totalIncome + metrics.totalRecover}
            onCategoryClick={(catId) => {
              if (catId) router.push(`/transactions?category=${catId}`)
            }}
          />
        </Card>
        <Card className="p-5">
          <h2 className="text-[10px] font-800 uppercase tracking-[2.5px] text-white/40 mb-4">Gastos por dia</h2>
          <BarChart
            data={metrics.dailyTotals}
            onDayClick={(date) => router.push(`/transactions?date_from=${date}&date_to=${date}`)}
          />
          {/* Category ranking */}
          <div className="mt-5 flex flex-col gap-2">
            {metrics.categoryRanking.slice(0, 5).map((item, i) => (
              <button
                key={item.category_name}
                onClick={() => item.category_id && router.push(`/transactions?category=${item.category_id}`)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
              >
                <span className="text-[11px] text-white/30 w-4 flex-shrink-0 font-700">{i + 1}</span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.category_color }} />
                <span className="flex-1 text-xs text-white/65 truncate">{item.category_name}</span>
                <span className="text-xs font-800 text-white flex-shrink-0">{formatCurrency(item.total)}</span>
                <span className="text-[10px] text-white/30 flex-shrink-0 w-10 text-right">{item.percentage.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Top transactions */}
      <div>
        <h2 className="text-[10px] font-800 uppercase tracking-[2.5px] text-white/40 mb-3">Maiores lançamentos</h2>
        {metrics.topTransactions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {metrics.topTransactions.map((tx, i) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                rank={i}
                onEdit={() => router.push(`/transactions?edit=${tx.id}`)}
                onDelete={() => {}}
                onDuplicate={() => {}}
                onMarkRecovered={() => {}}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={Activity} title="Sem lançamentos" description="Adicione seu primeiro lançamento no Extrato" />
        )}
      </div>
    </div>
  )
}
