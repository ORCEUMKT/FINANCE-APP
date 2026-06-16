'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CategoryGoal, CategoryGoalUpsert } from '@/types/goal'
import * as svc from '@/services/goalsService'
import { getCached, setCached } from '@/lib/queryCache'

const CACHE_KEY = 'goals'

export function useGoals() {
  const cached = getCached<CategoryGoal[]>(CACHE_KEY)
  const [goals, setGoals] = useState<CategoryGoal[]>(cached ?? [])
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (getCached<CategoryGoal[]>(CACHE_KEY) === undefined) setLoading(true)
    setError(null)
    try {
      const data = await svc.getGoals()
      setGoals(data)
      setCached(CACHE_KEY, data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar metas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const upsert = useCallback(async (payload: CategoryGoalUpsert) => {
    const goal = await svc.upsertGoal(payload)
    setGoals((prev) => {
      const exists = prev.some((g) => g.category_id === goal.category_id)
      const next = exists ? prev.map((g) => (g.category_id === goal.category_id ? goal : g)) : [...prev, goal]
      setCached(CACHE_KEY, next)
      return next
    })
    return goal
  }, [])

  const remove = useCallback(async (categoryId: string) => {
    await svc.deleteGoal(categoryId)
    setGoals((prev) => {
      const next = prev.filter((g) => g.category_id !== categoryId)
      setCached(CACHE_KEY, next)
      return next
    })
  }, [])

  return { goals, loading, error, refetch: fetch, upsert, remove }
}
