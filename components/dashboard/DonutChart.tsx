'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/formatters'
import type { CategoryRankItem } from '@/services/dashboardService'

interface DonutChartProps {
  data: CategoryRankItem[]
  total: number
  onCategoryClick?: (categoryId: string | null) => void
}

export function DonutChart({ data, total, onCategoryClick }: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (!total || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-sm" style={{ color: 'var(--text-3)' }}>
        Sem dados para exibir
      </div>
    )
  }

  const size = 200, cx = 100, cy = 100, R = 76, r = 46
  let cum = 0

  const segments = data.map((d) => {
    const start = (cum / total) * 2 * Math.PI - Math.PI / 2
    cum += d.total
    const end = (cum / total) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start)
    const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end)
    const x3 = cx + r * Math.cos(end),   y3 = cy + r * Math.sin(end)
    const x4 = cx + r * Math.cos(start), y4 = cy + r * Math.sin(start)
    const lg = (end - start) > Math.PI ? 1 : 0
    return {
      d: `M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${r} ${r} 0 ${lg} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`,
      item: d,
    }
  })

  const hoveredItem = hovered ? data.find((d) => d.category_id === hovered || d.category_name === hovered) : null

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full max-w-[200px]">
        <svg width="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {segments.map(({ d, item }) => (
            <path
              key={item.category_name}
              d={d}
              fill={item.category_color}
              opacity={hovered && hovered !== (item.category_id ?? item.category_name) ? 0.25 : 1}
              className="cursor-pointer transition-opacity duration-200"
              onMouseEnter={() => setHovered(item.category_id ?? item.category_name)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onCategoryClick?.(item.category_id)}
            />
          ))}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="#888898" fontSize="8" fontWeight="600" letterSpacing="1.5">
            {hoveredItem ? hoveredItem.category_name.split('/')[0].trim().toUpperCase() : 'TOTAL'}
          </text>
          <text x={cx} y={cy + 11} textAnchor="middle" fill="#eeeef6" fontSize="13" fontWeight="700">
            {formatCurrency(hoveredItem ? hoveredItem.total : total).replace(',00', '')}
          </text>
          <text x={cx} y={cy + 26} textAnchor="middle" fill="#888898" fontSize="9">
            {hoveredItem ? `${hoveredItem.percentage.toFixed(1)}%` : `${data.reduce((s, d) => s + d.count, 0)} lançamentos`}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
        {data.slice(0, 8).map((d) => (
          <button
            key={d.category_name}
            onClick={() => onCategoryClick?.(d.category_id)}
            onMouseEnter={() => setHovered(d.category_id ?? d.category_name)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-1.5 text-[11px] transition-colors"
            style={{ color: hovered === (d.category_id ?? d.category_name) ? 'var(--text-1)' : 'var(--text-2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: d.category_color }} />
            {d.category_name.split('/')[0].trim()}
            <span style={{ color: 'var(--text-3)' }}>{d.percentage.toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}
