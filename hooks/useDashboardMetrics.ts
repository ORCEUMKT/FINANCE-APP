'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDashboardMetrics, type DashboardMetrics } from '@/services/dashboardService'

export function useDashboardMetrics(dateFrom?: string, dateTo?: string) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDashboardMetrics(dateFrom, dateTo)
      setMetrics(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar métricas.')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { fetch() }, [fetch])

  return { metrics, loading, error, refetch: fetch }
}
