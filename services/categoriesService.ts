import { createClient } from '@/lib/supabase/client'
import type { Category, CategoryInsert, CategoryUpdate } from '@/types/category'
import { DEFAULT_CATEGORIES } from '@/types/category'

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) throw error
  return data as unknown as Category[]
}

export async function createCategory(payload: CategoryInsert): Promise<Category> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('categories')
    .insert({ ...payload, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Category
}

export async function updateCategory(id: string, payload: CategoryUpdate): Promise<Category> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as unknown as Category
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function seedDefaultCategories(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count && count > 0) return

  const rows = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    user_id: user.id,
    is_default: true,
  }))
  await supabase.from('categories').insert(rows)
}
