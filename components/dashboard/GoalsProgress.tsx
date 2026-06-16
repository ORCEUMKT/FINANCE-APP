'use client'

import { memo } from 'react'
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { CategoryGoal } from '@/types/goal'
import type { CategoryRankItem } from '@/services/dashboardService'
import type { Category } from '@/types/category'

interface GoalsProgressProps {
  goals: CategoryGoal[]
  categories: Category[]
  categoryRanking: CategoryRankItem[]
  onCategoryClick?: (categoryId: string) => void
}

const STATUS_COLOR = { ok: 'var(--green)', warning: 'var(--orange)', over: 'var(--red)' } as const
const STATUS_LABEL = { ok: 'Dentro da meta', warning: 'Atenção', over: 'Ultrapassou' } as const
const STATUS_ICON = { ok: CheckCircle2, warning: AlertTriangle, over: TrendingUp } as const

export const GoalsProgress = memo(function GoalsProgress({ goals, categories, categoryRanking, onCategoryClick }: GoalsProgressProps) {
  if (goals.length === 0) return null

  const items = goals
    .map((g) => {
      const cat = categories.find((c) => c.id === g.category_id)
      const rank = categoryRanking.find((r) => r.category_id === g.category_id)
      const spent = rank?.total ?? 0
      const percentage = g.amount > 0 ? (spent / g.amount) * 100 : 0
      const status: 'ok' | 'warning' | 'over' = percentage > 100 ? 'over' : percentage >= 80 ? 'warning' : 'ok'
      return {
        goalId: g.id,
        categoryId: g.category_id,
        name: cat?.name ?? rank?.category_name ?? 'Categoria',
        color: cat?.color ?? rank?.category_color ?? 'var(--accent)',
        goal: g.amount,
        spent,
        percentage,
        status,
      }
    })
    .sort((a, b) => b.percentage - a.percentage)

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const Icon = STATUS_ICON[item.status]
        return (
          <button
            key={item.goalId}
            onClick={() => item.categoryId && onCategoryClick?.(item.categoryId)}
            className="flex flex-col gap-2 text-left transition-opacity hover:opacity-80"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{item.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Icon size={11} style={{ color: STATUS_COLOR[item.status] }} />
                <span className="text-[10px] font-semibold" style={{ color: STATUS_COLOR[item.status] }}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(item.percentage, 100)}%`, background: STATUS_COLOR[item.status] }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-3)' }}>
              <span className="tabular">{formatCurrency(item.spent)} de {formatCurrency(item.goal)}</span>
              <span className="tabular font-semibold" style={{ color: STATUS_COLOR[item.status] }}>
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
})
