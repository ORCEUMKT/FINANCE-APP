'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Transaction, TransactionFilters, TransactionInsert, TransactionUpdate } from '@/types/transaction'
import * as svc from '@/services/transactionsService'
import { getCached, setCached } from '@/lib/queryCache'

export function useTransactions(filters?: TransactionFilters) {
  const cacheKey = `transactions:${JSON.stringify(filters)}`
  const cached = getCached<Transaction[]>(cacheKey)
  const [transactions, setTransactions] = useState<Transaction[]>(cached ?? [])
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (getCached<Transaction[]>(cacheKey) === undefined) setLoading(true)
    setError(null)
    try {
      const data = await svc.getTransactions(filters)
      setTransactions(data)
      setCached(cacheKey, data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar lançamentos.')
    } finally {
      setLoading(false)
    }
  }, [cacheKey]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const add = useCallback(async (payload: TransactionInsert) => {
    const tx = await svc.createTransaction(payload)
    setTransactions((prev) => {
      // Only show in current view if it falls within the active date filter
      if (filters?.date_from && tx.date < filters.date_from) return prev
      if (filters?.date_to && tx.date > filters.date_to) return prev
      const next = [tx, ...prev]
      setCached(cacheKey, next)
      return next
    })
    return tx
  }, [cacheKey, filters?.date_from, filters?.date_to]) // eslint-disable-line

  const update = useCallback(async (id: string, payload: TransactionUpdate) => {
    const tx = await svc.updateTransaction(id, payload)
    setTransactions((prev) => {
      const next = prev.map((t) => (t.id === id ? tx : t))
      setCached(cacheKey, next)
      return next
    })
    return tx
  }, [cacheKey])

  const remove = useCallback(async (id: string) => {
    await svc.deleteTransaction(id)
    setTransactions((prev) => {
      const next = prev.filter((t) => t.id !== id)
      setCached(cacheKey, next)
      return next
    })
  }, [cacheKey])

  const duplicate = useCallback(async (id: string) => {
    const tx = await svc.duplicateTransaction(id)
    setTransactions((prev) => {
      const next = [tx, ...prev]
      setCached(cacheKey, next)
      return next
    })
    return tx
  }, [cacheKey])

  const markRecovered = useCallback(async (id: string) => {
    const tx = await svc.markAsRecovered(id)
    setTransactions((prev) => {
      const next = prev.map((t) => (t.id === id ? tx : t))
      setCached(cacheKey, next)
      return next
    })
    return tx
  }, [cacheKey])

  const removeGroup = useCallback(async (transaction: Transaction) => {
    const ids = await svc.deleteInstallmentGroup(transaction)
    setTransactions((prev) => {
      const next = prev.filter((t) => !ids.includes(t.id))
      setCached(cacheKey, next)
      return next
    })
  }, [cacheKey])

  const updateGroupDates = useCallback(async (transaction: Transaction, newDate: string) => {
    await svc.updateInstallmentGroupDates(transaction, newDate)
  }, [])

  return { transactions, loading, error, refetch: fetch, add, update, remove, duplicate, markRecovered, removeGroup, updateGroupDates }
}
