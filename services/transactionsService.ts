import { createClient } from '@/lib/supabase/client'
import { parseInstallment, installmentGroupDescriptions } from '@/lib/installments'
import type {
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  TransactionFilters,
  PersonalTransactionsPageResult,
} from '@/types/transaction'

export async function getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
  const supabase = createClient()

  const byValue = filters?.sort_by === 'value'
  let query = supabase
    .from('transactions')
    .select('*, category:categories(*)')

  if (byValue) {
    query = query.order('value', { ascending: false })
  } else {
    query = query.order('date', { ascending: false }).order('created_at', { ascending: false })
  }

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

export async function getPersonalTransactionsPage(params: {
  dateFrom?: string | null
  dateTo?: string | null
  categoryId?: string | null
  search?: string | null
  sortBy?: 'date' | 'value'
  page?: number
  pageSize?: number
}): Promise<PersonalTransactionsPageResult> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_personal_transactions_page', {
    p_date_from:   params.dateFrom   ?? null,
    p_date_to:     params.dateTo     ?? null,
    p_category_id: params.categoryId ?? null,
    p_search:      params.search     ?? null,
    p_type:        null,
    p_status:      null,
    p_sort_by:     params.sortBy     ?? 'date',
    p_page:        params.page       ?? 1,
    p_page_size:   params.pageSize   ?? 50,
  })
  if (error) throw error
  const payload = data as { total_count: number; total_value: number; rows: unknown[] } | null
  return {
    total_count: payload?.total_count ?? 0,
    total_value: payload?.total_value ?? 0,
    rows: (payload?.rows ?? []) as Transaction[],
  }
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

export async function deleteInstallmentGroup(transaction: Transaction): Promise<string[]> {
  const supabase = createClient()
  const parsed = parseInstallment(transaction.description)
  const groupDescriptions = parsed ? installmentGroupDescriptions(parsed) : null
  if (!groupDescriptions) {
    await deleteTransaction(transaction.id)
    return [transaction.id]
  }

  const { data: siblings, error: siblingsError } = await supabase
    .from('transactions')
    .select('id')
    .in('description', groupDescriptions)
  if (siblingsError) throw siblingsError

  const ids = (siblings ?? []).map((s: { id: string }) => s.id)
  if (ids.length === 0) {
    await deleteTransaction(transaction.id)
    return [transaction.id]
  }

  const { error } = await supabase.from('transactions').delete().in('id', ids)
  if (error) throw error
  return ids
}

export async function updateInstallmentGroupDates(
  transaction: Transaction,
  newDate: string,
): Promise<void> {
  const supabase = createClient()
  const parsed = parseInstallment(transaction.description)
  const groupDescriptions = parsed ? installmentGroupDescriptions(parsed) : null
  if (!groupDescriptions) {
    await updateTransaction(transaction.id, { date: newDate })
    return
  }

  const origMs = new Date(transaction.date + 'T00:00:00').getTime()
  const newMs = new Date(newDate + 'T00:00:00').getTime()
  const deltaDays = Math.round((newMs - origMs) / (1000 * 60 * 60 * 24))

  const { data: siblings, error: siblingsError } = await supabase
    .from('transactions')
    .select('id, date')
    .in('description', groupDescriptions)
  if (siblingsError) throw siblingsError

  if (!siblings || siblings.length === 0) {
    await updateTransaction(transaction.id, { date: newDate })
    return
  }

  await Promise.all(
    (siblings as { id: string; date: string }[]).map((s) => {
      const shifted = new Date(
        new Date(s.date + 'T00:00:00').getTime() + deltaDays * 86400000,
      ).toISOString().slice(0, 10)
      return updateTransaction(s.id, { date: shifted })
    }),
  )
}
