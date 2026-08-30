'use client'

import { useState, useEffect } from 'react'
import type { ABCTransaction } from '@/types/transaction'
import { getPersonalABCData } from '@/services/transactionsService'
import { subscribeInvalidation } from '@/lib/queryCache'

export function usePersonalABC({
  dateFrom,
  dateTo,
  type,
}: {
  dateFrom: string
  dateTo: string
  type: 'expense' | 'income' | 'recover' | null
}) {
  const [transactions, setTransactions] = useState<ABCTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPersonalABCData({ dateFrom, dateTo, type })
      .then((data) => {
        if (!cancelled) { setTransactions(data); setLoading(false) }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar dados ABC.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [dateFrom, dateTo, type, refreshKey])

  // Refetch when any mutation broadcasts a tx_change invalidation (e.g. adding a transaction
  // from another screen while the ABC view is mounted).
  useEffect(() => {
    return subscribeInvalidation((prefix) => {
      if ('transactions:'.startsWith(prefix)) {
        setRefreshKey((k) => k + 1)
      }
    })
  }, [])

  return { transactions, loading, error }
}
