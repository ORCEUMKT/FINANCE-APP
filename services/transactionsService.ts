import { createClient } from '@/lib/supabase/client'
import type {
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  TransactionFilters,
} from '@/types/transaction'

export async function getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
  const supabase = createClient()

  let query = supabase
    .from('transactions')
    .select('*, category:categories(*)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.search) {
    query = query.ilike('description', `%${filters.search}%`)
  }
  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id)
  }
  if (filters?.type) {
    query = query.eq('type', filters.type)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.date_from) {
    query = query.gte('date', filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte('date', filters.date_to)
  }

  const { data, error } = await query
  if (error) throw error
  return data as unknown as Transaction[]
}

export async function createTransaction(payload: TransactionInsert): Promise<Transaction> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: user.id })
    .select('*, category:categories(*)')
    .single()
  if (error) throw error
  return data as unknown as Transaction
}

export async function updateTransaction(id: string, payload: TransactionUpdate): Promise<Transaction> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select('*, category:categories(*)')
    .single()
  if (error) throw error
  return data as unknown as Transaction
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function duplicateTransaction(id: string): Promise<Transaction> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: original, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = original
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...rest, description: rest.description + ' (cópia)', user_id: user.id })
    .select('*, category:categories(*)')
    .single()
  if (error) throw error
  return data as unknown as Transaction
}

export async function markAsRecovered(id: string): Promise<Transaction> {
  return updateTransaction(id, { status: 'recovered' })
}
