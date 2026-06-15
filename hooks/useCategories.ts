'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Category, CategoryInsert, CategoryUpdate } from '@/types/category'
import * as svc from '@/services/categoriesService'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await svc.getCategories()
      setCategories(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar categorias.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = useCallback(async (payload: CategoryInsert) => {
    const cat = await svc.createCategory(payload)
    setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
    return cat
  }, [])

  const update = useCallback(async (id: string, payload: CategoryUpdate) => {
    const cat = await svc.updateCategory(id, payload)
    setCategories((prev) => prev.map((c) => (c.id === id ? cat : c)))
    return cat
  }, [])

  const remove = useCallback(async (id: string) => {
    await svc.deleteCategory(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { categories, loading, error, refetch: fetch, add, update, remove }
}
