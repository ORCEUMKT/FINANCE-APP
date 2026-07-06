import type { Category } from './category'
import type { TransactionType, TransactionStatus } from './database'

export type { TransactionType, TransactionStatus }

export interface Transaction {
  id: string
  user_id: string
  category_id: string | null
  account_id: string | null
  description: string
  value: number
  date: string
  type: TransactionType
  status: TransactionStatus
  notes: string | null
  created_at: string
  updated_at: string
  category?: Category | null
  owner_name?: string | null
}

export type TransactionInsert = {
  category_id?: string | null
  account_id?: string | null
  description: string
  value: number
  date: string
  type?: TransactionType
  status?: TransactionStatus
  notes?: string | null
}

export type TransactionUpdate = Partial<TransactionInsert>

export interface TransactionFilters {
  search?: string
  category_id?: string | null
  type?: TransactionType | null
  status?: TransactionStatus | null
  date_from?: string | null
  date_to?: string | null
  sort_by?: 'date' | 'value'
}
