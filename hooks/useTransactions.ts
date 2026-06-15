'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Transaction, TransactionFilters, TransactionInsert, TransactionUpdate } from '@/types/transaction'
import * as svc from '@/services/transactionsService'

export function useTransactions(filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await svc.getTransactions(filters)
      setTransactions(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar lançamentos.')
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const add = useCallback(async (payload: TransactionInsert) => {
    const tx = await svc.createTransaction(payload)
    setTransactions((prev) => [tx, ...prev])
    return tx
  }, [])

  const update = useCallback(async (id: string, payload: TransactionUpdate) => {
    const tx = await svc.updateTransaction(id, payload)
    setTransactions((prev) => prev.map((t) => (t.id === id ? tx : t)))
    return tx
  }, [])

  const remove = useCallback(async (id: string) => {
    await svc.deleteTransaction(id)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const duplicate = useCallback(async (id: string) => {
    const tx = await svc.duplicateTransaction(id)
    setTransactions((prev) => [tx, ...prev])
    return tx
  }, [])

  const markRecovered = useCallback(async (id: string) => {
    const tx = await svc.markAsRecovered(id)
    setTransactions((prev) => prev.map((t) => (t.id === id ? tx : t)))
    return tx
  }, [])

  return { transactions, loading, error, refetch: fetch, add, update, remove, duplicate, markRecovered }
}
