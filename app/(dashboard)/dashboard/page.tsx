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

export default function DashboardPage() {
  const { metrics, loading } = useDashboardMetrics()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="flex flex-col gap-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-4">
          <div
            className="w-[3px] h-12 rounded-full mt-0.5 flex-shrink-0"
            style={{ background: 'var(--accent)', boxShadow: 'var(--glow-accent)' }}
          />
          <div>
            <p
              className="text-[9px] font-semibold uppercase tracking-[2.5px] mb-1.5"
              style={{ color: 'var(--accent)' }}
            >
              Finanças
            </p>
            <h1
              className="text-[22px] font-bold leading-none"
              style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}
            >
              Dashboard
            </h1>
            <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-3)' }}>
              Visão geral das suas finanças
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/transactions')} size="sm">
          <Plus size={13} /> Lançamento
        </Button>
      </div>

      {/* Metric cards — number as focal point */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Despesas"
          value={metrics.totalExpenses}
          icon={TrendingDown}
          color="var(--red)"
          trend={`${metrics.transactionCount} lançamentos`}
        />
        <MetricCard
          label="Receitas"
          value={metrics.totalIncome}
          icon={TrendingUp}
          color="var(--green)"
        />
        <MetricCard
          label="Saldo Líquido"
          value={metrics.liquidTotal}
          icon={Activity}
          color="var(--accent)"
          trend={metrics.liquidTotal >= 0 ? 'Positivo' : 'Negativo'}
        />
        {metrics.totalRecover > 0 && (
          <MetricCard
            label="A Recuperar"
            value={metrics.totalRecover}
            icon={RotateCcw}
            color="var(--orange)"
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p
            className="text-[9px] font-semibold uppercase tracking-[2px] mb-5"
            style={{ color: 'var(--text-3)' }}
          >
            Composição
          </p>
          <DonutChart
            data={metrics.categoryRanking}
            total={metrics.totalExpenses + metrics.totalIncome + metrics.totalRecover}
            onCategoryClick={(catId) => {
              if (catId) router.push(`/transactions?category=${catId}`)
            }}
          />
        </Card>

        <Card className="p-5">
          <p
            className="text-[9px] font-semibold uppercase tracking-[2px] mb-5"
            style={{ color: 'var(--text-3)' }}
          >
            Gastos por dia
          </p>
          <BarChart
            data={metrics.dailyTotals}
            onDayClick={(date) => router.push(`/transactions?date_from=${date}&date_to=${date}`)}
          />
          <div className="mt-6 flex flex-col gap-2.5">
            {metrics.categoryRanking.slice(0, 5).map((item, i) => (
              <button
                key={item.category_name}
                onClick={() => item.category_id && router.push(`/transactions?category=${item.category_id}`)}
                className="flex items-center gap-3 text-left transition-opacity duration-150 hover:opacity-70"
              >
                <span
                  className="text-[10px] w-4 flex-shrink-0 tabular font-semibold"
                  style={{ color: 'var(--text-3)' }}
                >
                  {i + 1}
                </span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.category_color }} />
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-2)' }}>
                  {item.category_name}
                </span>
                <span className="text-[12px] font-semibold flex-shrink-0 tabular" style={{ color: 'var(--text-1)' }}>
                  {formatCurrency(item.total)}
                </span>
                <span className="text-[10px] flex-shrink-0 w-9 text-right tabular" style={{ color: 'var(--text-3)' }}>
                  {item.percentage.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Top transactions */}
      <div>
        <p
          className="text-[9px] font-semibold uppercase tracking-[2px] mb-4"
          style={{ color: 'var(--text-3)' }}
        >
          Maiores lançamentos
        </p>
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
          <EmptyState
            icon={Activity}
            title="Sem lançamentos"
            description="Adicione seu primeiro lançamento no Extrato"
          />
        )}
      </div>

    </div>
  )
}
