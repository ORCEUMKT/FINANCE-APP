'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { DailyTotal } from '@/services/dashboardService'

interface BarChartProps {
  data: DailyTotal[]
  onDayClick?: (date: string) => void
}

export function BarChart({ data, onDayClick }: BarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (!data.length) {
    return (
      <div className="h-32 flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>
        Sem dados
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.total), 1)

  return (
    <div className="flex items-end gap-1.5 h-28 w-full">
      {data.map((d) => {
        const h = Math.max((d.total / max) * 88, d.total > 0 ? 6 : 2)
        const isHov = hovered === d.date
        const label = d.date.slice(8, 10)
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
            onMouseEnter={() => setHovered(d.date)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onDayClick?.(d.date)}
            title={`${formatDate(d.date)} · ${formatCurrency(d.total)}`}
          >
            <span className="text-[8px] font-medium whitespace-nowrap" style={{ color: isHov && d.total > 0 ? 'var(--text-2)' : 'transparent' }}>
              {formatCurrency(d.total).replace('R$ ', 'R$')}
            </span>
            <div
              className="w-full rounded-lg transition-all duration-200"
              style={{
                height: h,
                background: isHov
                  ? 'var(--accent)'
                  : `linear-gradient(180deg, rgba(124,90,252,0.55), rgba(124,90,252,0.18))`,
                opacity: d.total > 0 ? 1 : 0.2,
                border: '1px solid rgba(124,90,252,0.15)',
              }}
            />
            <span
              className="text-[9px] font-medium transition-colors"
              style={{ color: isHov ? 'var(--text-2)' : 'var(--text-3)' }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
