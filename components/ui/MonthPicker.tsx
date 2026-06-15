'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export interface MonthValue {
  year: number
  month: number // 0-11
}

export function monthRange(v: MonthValue) {
  const y = v.year
  const m = v.month
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { dateFrom: from, dateTo: to }
}

export function currentMonth(): MonthValue {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

interface MonthPickerProps {
  value: MonthValue
  onChange: (v: MonthValue) => void
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  function prev() {
    if (value.month === 0) onChange({ year: value.year - 1, month: 11 })
    else onChange({ year: value.year, month: value.month - 1 })
  }
  function next() {
    if (value.month === 11) onChange({ year: value.year + 1, month: 0 })
    else onChange({ year: value.year, month: value.month + 1 })
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={prev}
        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
        style={{ color: 'var(--text-3)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
      >
        <ChevronLeft size={15} />
      </button>
      <span
        className="text-[13px] font-semibold px-2 min-w-[130px] text-center"
        style={{ color: 'var(--text-1)' }}
      >
        {MONTHS[value.month]} {value.year}
      </span>
      <button
        onClick={next}
        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
        style={{ color: 'var(--text-3)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
