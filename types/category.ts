export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  type: 'expense' | 'income' | 'both'
  is_default: boolean
  created_at: string
}

export type CategoryInsert = {
  name: string
  icon?: string
  color?: string
  type?: Category['type']
}

export type CategoryUpdate = Partial<CategoryInsert>

export const DEFAULT_CATEGORIES: Omit<CategoryInsert, never>[] = [
  { name: 'Despesas de Casa', icon: 'home',     color: '#E17055', type: 'expense' },
  { name: 'Alimentação',      icon: 'utensils', color: '#F7B731', type: 'expense' },
  { name: 'Saúde',            icon: 'heart',    color: '#4ECCA3', type: 'expense' },
  { name: 'Esporte',          icon: 'activity', color: '#74B9FF', type: 'expense' },
  { name: 'Passeio',          icon: 'map-pin',  color: '#A29BFE', type: 'expense' },
]
