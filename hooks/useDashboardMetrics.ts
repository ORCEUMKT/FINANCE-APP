'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDashboardMetrics, type DashboardMetrics } from '@/services/dashboardService'
import { getCached, setCached, subscribeInvalidation } from '@/lib/queryCache'

export function useDashboardMetrics(dateFrom?: string, dateTo?: string) {
  const cacheKey = `dashboard:${dateFrom}:${dateTo}`
  const cached = getCached<DashboardMetrics>(cacheKey)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(cached ?? null)
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (getCached<DashboardMetrics>(cacheKey) === undefined) setLoading(true)
    setError(null)
    try {
      const data = await getDashboardMetrics(dateFrom, dateTo)
      setMetrics(data)
      setCached(cacheKey, data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar métricas.')
    } finally {
      setLoading(false)
    }
  }, [cacheKey, dateFrom, dateTo]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  // Refetch imediato quando o cache deste prefixo for invalidado externamente (ex: broadcast tx_change)
  useEffect(() => {
    return subscribeInvalidation((prefix) => {
      if (cacheKey.startsWith(prefix)) fetch()
    })
  }, [cacheKey, fetch])

  return { metrics, loading, error, refetch: fetch }
}
