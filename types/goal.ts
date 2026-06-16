export interface CategoryGoal {
  id: string
  user_id: string
  category_id: string
  amount: number
  created_at: string
  updated_at: string
}

export type CategoryGoalUpsert = {
  category_id: string
  amount: number
}
