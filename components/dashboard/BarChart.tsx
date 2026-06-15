'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { formatDate } from '@/lib/formatters'
import type { DailyTotal } from '@/services/dashboardService'

interface BarChartProps {
  data: DailyTotal[]
  onDayClick?: (date: string) => void
}

export function BarChart({ data, onDayClick }: BarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  if (!data.length) return <div className="h-32 flex items-center justify-center text-white/25 text-sm">Sem dados</div>

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
            className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
            onMouseEnter={() => setHovered(d.date)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onDayClick?.(d.date)}
            title={`${formatDate(d.date)} · ${formatCurrency(d.total)}`}
          >
            {isHov && d.total > 0 && (
              <span className="text-[8px] font-700 text-white/60 whitespace-nowrap">
                {formatCurrency(d.total).replace('R$ ', 'R$')}
              </span>
            )}
            {!isHov && <span className="text-[8px] opacity-0">·</span>}
            <div
              className="w-full rounded-lg transition-all duration-200 border border-white/[.07]"
              style={{
                height: h,
                background: isHov
                  ? 'rgba(255,255,255,.9)'
                  : 'linear-gradient(180deg, rgba(255,255,255,.65), rgba(255,255,255,.18))',
                opacity: d.total > 0 ? 1 : 0.3,
              }}
            />
            <span className="text-[9px] text-white/30 font-600 group-hover:text-white/60 transition-colors">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
