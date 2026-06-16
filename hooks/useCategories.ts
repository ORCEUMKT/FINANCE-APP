'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Category, CategoryInsert, CategoryUpdate } from '@/types/category'
import * as svc from '@/services/categoriesService'
import { getCached, setCached } from '@/lib/queryCache'

const CACHE_KEY = 'categories'

export function useCategories() {
  const cached = getCached<Category[]>(CACHE_KEY)
  const [categories, setCategories] = useState<Category[]>(cached ?? [])
  const [loading, setLoading] = useState(cached === undefined)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (getCached<Category[]>(CACHE_KEY) === undefined) setLoading(true)
    setError(null)
    try {
      const data = await svc.getCategories()
      setCategories(data)
      setCached(CACHE_KEY, data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar categorias.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = useCallback(async (payload: CategoryInsert) => {
    const cat = await svc.createCategory(payload)
    setCategories((prev) => {
      const next = [...prev, cat].sort((a, b) => a.name.localeCompare(b.name))
      setCached(CACHE_KEY, next)
      return next
    })
    return cat
  }, [])

  const update = useCallback(async (id: string, payload: CategoryUpdate) => {
    const cat = await svc.updateCategory(id, payload)
    setCategories((prev) => {
      const next = prev.map((c) => (c.id === id ? cat : c))
      setCached(CACHE_KEY, next)
      return next
    })
    return cat
  }, [])

  const remove = useCallback(async (id: string) => {
    await svc.deleteCategory(id)
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id)
      setCached(CACHE_KEY, next)
      return next
    })
  }, [])

  return { categories, loading, error, refetch: fetch, add, update, remove }
}
