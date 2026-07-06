'use client'

import { useState, useEffect, useCallback } from 'react'
import { getUnifiedDashboardMetrics, type DashboardMetrics } from '@/services/dashboardService'

export function useUnifiedDashboardMetrics(
  sharedAccountId: string | null,
  filterUserId: string | null,
  dateFrom?: string,
  dateTo?: string
) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!sharedAccountId) { setMetrics(null); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getUnifiedDashboardMetrics(sharedAccountId, filterUserId, dateFrom, dateTo)
      setMetrics(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar métricas unificadas.')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [sharedAccountId, filterUserId, dateFrom, dateTo])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch() }, [fetch])

  return { metrics, loading, error, refetch: fetch }
}
