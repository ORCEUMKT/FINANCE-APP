'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { TrendingDown, TrendingUp, RotateCcw, Activity, Plus } from 'lucide-react'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useCategories } from '@/hooks/useCategories'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DonutChart } from '@/components/dashboard/DonutChart'
import { BarChart } from '@/components/dashboard/BarChart'
import { TransactionCard } from '@/components/transactions/TransactionCard'
import { MonthPicker, monthRange, currentMonth, type MonthValue } from '@/components/ui/MonthPicker'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/formatters'
import { parseVoiceInput, type VoicePrefill } from '@/lib/voiceParser'
import { createTransaction } from '@/services/transactionsService'
import type { TransactionInsert } from '@/types/transaction'

const VoiceMicButton = dynamic(() => import('@/components/ui/VoiceMicButton').then(m => m.VoiceMicButton), { ssr: false })
const TransactionForm = dynamic(() => import('@/components/transactions/TransactionForm').then(m => m.TransactionForm), { ssr: false })

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<MonthValue>(currentMonth)
  const { dateFrom, dateTo } = monthRange(selectedMonth)
  const { metrics, loading, refetch } = useDashboardMetrics(dateFrom, dateTo)
  const { categories } = useCategories()
  const { toast } = useToast()
  const router = useRouter()

  const [formOpen, setFormOpen]         = useState(false)
  const [voicePrefill, setVoicePrefill] = useState<VoicePrefill | null>(null)

  function openForm(prefill?: VoicePrefill) {
    setVoicePrefill(prefill ?? null)
    setFormOpen(true)
  }

  async function handleSubmit(data: TransactionInsert) {
    await createTransaction(data)
    toast('Lançamento adicionado!')
    await refetch()
  }

  const chartTotal = useMemo(
    () => (metrics?.totalExpenses ?? 0) + (metrics?.totalIncome ?? 0) + (metrics?.totalRecover ?? 0),
    [metrics?.totalExpenses, metrics?.totalIncome, metrics?.totalRecover]
  )
  const balanceColor = (metrics?.liquidTotal ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    )
  }

  if (!metrics) return null

  return (
    <>
      {/* ═══════════════════════════════════════
          MOBILE LAYOUT (lg:hidden)
      ═══════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col gap-5 pb-4">

        {/* Month selector + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push('/transactions?new=1')} size="sm" className="gap-1.5 px-4 text-[13px] whitespace-nowrap">
              <Plus size={13} /> Novo Lançamento
            </Button>
            <VoiceMicButton
              onResult={(transcript) => {
                const parsed = parseVoiceInput(transcript)
                toast(`Detectado: "${transcript}"`)
                openForm(parsed)
              }}
              onError={(msg) => toast(msg)}
            />
          </div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* Saldo Líquido — solto, sem Card (estilo banco) */}
        <div className="px-1 py-2">
          <div
            className="inline-flex items-center px-3 py-1 rounded-full mb-3"
            style={{ border: '1px solid var(--border-md)' }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[2.5px]" style={{ color: 'var(--text-3)' }}>
              Saldo Líquido
            </p>
          </div>
          <div
            className="text-[40px] font-bold leading-none tabular"
            style={{ color: balanceColor, letterSpacing: '-0.03em' }}
          >
            {formatCurrency(metrics.liquidTotal)}
          </div>
          <p className="text-[13px] font-semibold mt-2" style={{ color: balanceColor }}>
            {metrics.liquidTotal >= 0 ? 'Positivo' : 'Negativo'}
          </p>
        </div>

        {/* Despesas + Receitas em cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-3" style={{ color: 'var(--text-3)' }}>Despesas</p>
            <div className="text-[20px] font-bold tabular truncate" style={{ color: 'var(--red)', letterSpacing: '-0.02em' }}>
              {formatCurrency(metrics.totalExpenses)}
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-3)' }}>{metrics.expenseCount} lançamentos</p>
          </Card>
          <Card className="p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-3" style={{ color: 'var(--text-3)' }}>Receitas</p>
            <div className="text-[20px] font-bold tabular truncate" style={{ color: 'var(--green)', letterSpacing: '-0.02em' }}>
              {formatCurrency(metrics.totalIncome)}
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-3)' }}>{metrics.incomeCount} receitas</p>
          </Card>
        </div>

        {/* Composição — tamanho normal, clicável */}
        <Card className="p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-5" style={{ color: 'var(--text-3)' }}>
            Composição
          </p>
          <DonutChart
            data={metrics.categoryRanking}
            total={chartTotal}
            onCategoryClick={(catId) => { if (catId) router.push(`/transactions?category=${catId}`) }}
          />
        </Card>

        {/* Gastos por dia */}
        <Card className="p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-5" style={{ color: 'var(--text-3)' }}>
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
                className="flex items-center gap-3 text-left transition-opacity hover:opacity-70"
              >
                <span className="text-[10px] w-4 flex-shrink-0 tabular font-semibold" style={{ color: 'var(--text-3)' }}>{i + 1}</span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.category_color }} />
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-2)' }}>{item.category_name}</span>
                <span className="text-[12px] font-semibold flex-shrink-0 tabular" style={{ color: 'var(--text-1)' }}>{formatCurrency(item.total)}</span>
                <span className="text-[10px] flex-shrink-0 w-9 text-right tabular" style={{ color: 'var(--text-3)' }}>{item.percentage.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Maiores lançamentos */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-4" style={{ color: 'var(--text-3)' }}>
            Maiores lançamentos
          </p>
          {metrics.topTransactions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {metrics.topTransactions.map((tx, i) => (
                <TransactionCard
                  key={tx.id}
                  transaction={tx}
                  rank={i}
                  onEdit={(t) => router.push(`/transactions?edit=${t.id}`)}
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

      {/* ═══════════════════════════════════════
          DESKTOP LAYOUT (hidden on mobile)
      ═══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col gap-8">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: 'var(--text-1)' }}>Dashboard</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Visão geral das suas finanças</p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            <Button onClick={() => router.push('/transactions?new=1')} size="sm">
              <Plus size={13} /> Lançamento
            </Button>
          </div>
        </div>

        {/* 4-card metric grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Saldo Líquido" value={metrics.liquidTotal} icon={Activity} color={balanceColor} trend={metrics.liquidTotal >= 0 ? 'Positivo' : 'Negativo'} />
          <MetricCard label="Despesas" value={metrics.totalExpenses} icon={TrendingDown} color="var(--red)" trend={`${metrics.expenseCount} lançamentos`} />
          <MetricCard label="Receitas" value={metrics.totalIncome} icon={TrendingUp} color="var(--text-1)" trend={`${metrics.incomeCount} receitas`} />
          {metrics.totalRecover > 0 && (
            <MetricCard label="A Recuperar" value={metrics.totalRecover} icon={RotateCcw} color="var(--orange)" />
          )}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-5" style={{ color: 'var(--text-3)' }}>
              Composição
            </p>
            <DonutChart
              data={metrics.categoryRanking}
              total={chartTotal}
              onCategoryClick={(catId) => { if (catId) router.push(`/transactions?category=${catId}`) }}
            />
          </Card>

          <Card className="p-5">
            <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-5" style={{ color: 'var(--text-3)' }}>
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
                  <span className="text-[10px] w-4 flex-shrink-0 tabular font-semibold" style={{ color: 'var(--text-3)' }}>{i + 1}</span>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.category_color }} />
                  <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-2)' }}>{item.category_name}</span>
                  <span className="text-[12px] font-semibold flex-shrink-0 tabular" style={{ color: 'var(--text-1)' }}>{formatCurrency(item.total)}</span>
                  <span className="text-[10px] flex-shrink-0 w-9 text-right tabular" style={{ color: 'var(--text-3)' }}>{item.percentage.toFixed(1)}%</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Top transactions */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[2px] mb-4" style={{ color: 'var(--text-3)' }}>
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

      {/* TransactionForm (mobile quick-add) */}
      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setVoicePrefill(null) }}
        onSubmit={handleSubmit}
        categories={categories}
        prefill={voicePrefill}
      />
    </>
  )
}
