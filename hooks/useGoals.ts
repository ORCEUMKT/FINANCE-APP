'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CategoryGoal, CategoryGoalUpsert } from '@/types/goal'
import * as svc from '@/services/goalsService'

export function useGoals() {
  const [goals, setGoals] = useState<CategoryGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await svc.getGoals()
      setGoals(data)
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
      return exists ? prev.map((g) => (g.category_id === goal.category_id ? goal : g)) : [...prev, goal]
    })
    return goal
  }, [])

  const remove = useCallback(async (categoryId: string) => {
    await svc.deleteGoal(categoryId)
    setGoals((prev) => prev.filter((g) => g.category_id !== categoryId))
  }, [])

  return { goals, loading, error, refetch: fetch, upsert, remove }
}
