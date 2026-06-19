'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { currentMonth, type MonthValue } from '@/components/ui/MonthPicker'

interface MonthCtx {
  month: MonthValue
  setMonth: (m: MonthValue) => void
}

const MonthContext = createContext<MonthCtx>({ month: currentMonth(), setMonth: () => {} })

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<MonthValue>(currentMonth)
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>
}

export function useSelectedMonth() {
  return useContext(MonthContext)
}
