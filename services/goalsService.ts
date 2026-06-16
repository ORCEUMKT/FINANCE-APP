import { createClient } from '@/lib/supabase/client'
import type { CategoryGoal, CategoryGoalUpsert } from '@/types/goal'

export async function getGoals(): Promise<CategoryGoal[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('category_goals')
    .select('*')
  if (error) throw error
  return data as unknown as CategoryGoal[]
}

export async function upsertGoal(payload: CategoryGoalUpsert): Promise<CategoryGoal> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('category_goals')
    .upsert(
      { category_id: payload.category_id, amount: payload.amount, user_id: user.id },
      { onConflict: 'user_id,category_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data as unknown as CategoryGoal
}

export async function deleteGoal(categoryId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('category_goals').delete().eq('category_id', categoryId)
  if (error) throw error
}
