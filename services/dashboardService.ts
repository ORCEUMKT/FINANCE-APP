import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types/transaction'

export interface DashboardMetrics {
  totalExpenses: number
  totalIncome: number
  totalRecover: number
  liquidTotal: number
  transactionCount: number
  expenseCount: number
  incomeCount: number
  categoryRanking: CategoryRankItem[]
  dailyTotals: DailyTotal[]
  topTransactions: Transaction[]
  biggestCategory: CategoryRankItem | null
}

export interface CategoryRankItem {
  category_id: string | null
  category_name: string
  category_color: string
  total: number
  count: number
  percentage: number
}

export interface DailyTotal {
  date: string
  total: number
  count: number
}

export async function getDashboardMetrics(
  dateFrom?: string,
  dateTo?: string
): Promise<DashboardMetrics> {
  const supabase = createClient()

  let query = supabase
    .from('transactions')
    .select('*, category:categories(*)')
    .order('date', { ascending: false })

  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo)   query = query.lte('date', dateTo)

  const { data, error } = await query
  if (error) throw error

  const txs = data as unknown as Transaction[]

  const expenses = txs.filter((t) => t.type === 'expense')
  const income   = txs.filter((t) => t.type === 'income')
  const recover  = txs.filter((t) => t.type === 'recover' && t.status !== 'recovered')

  const totalExpenses = expenses.reduce((s, t) => s + t.value, 0)
  const totalIncome   = income.reduce((s, t) => s + t.value, 0)
  const totalRecover  = recover.reduce((s, t) => s + t.value, 0)
  const liquidTotal   = totalIncome - totalExpenses

  // Category ranking
  const catMap = new Map<string, { name: string; color: string; total: number; count: number; id: string | null }>()
  txs.forEach((t) => {
    const key = t.category_id ?? '__none__'
    const existing = catMap.get(key)
    if (existing) {
      existing.total += t.value
      existing.count += 1
    } else {
      catMap.set(key, {
        id: t.category_id,
        name: t.category?.name ?? 'Sem categoria',
        color: t.category?.color ?? '#666',
        total: t.value,
        count: 1,
      })
    }
  })

  const grandTotal = txs.reduce((s, t) => s + t.value, 0)
  const categoryRanking: CategoryRankItem[] = Array.from(catMap.entries())
    .map(([, v]) => ({
      category_id: v.id,
      category_name: v.name,
      category_color: v.color,
      total: v.total,
      count: v.count,
      percentage: grandTotal > 0 ? (v.total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Daily totals
  const dayMap = new Map<string, { total: number; count: number }>()
  txs.forEach((t) => {
    const day = t.date
    const existing = dayMap.get(day)
    if (existing) { existing.total += t.value; existing.count += 1 }
    else dayMap.set(day, { total: t.value, count: 1 })
  })
  const dailyTotals: DailyTotal[] = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const topTransactions = [...txs]
    .filter((t) => t.type !== 'recover')
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return {
    totalExpenses,
    totalIncome,
    totalRecover,
    liquidTotal,
    transactionCount: txs.length,
    expenseCount: expenses.length,
    incomeCount: income.length,
    categoryRanking,
    dailyTotals,
    topTransactions,
    biggestCategory: categoryRanking[0] ?? null,
  }
}
