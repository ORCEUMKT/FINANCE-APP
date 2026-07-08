import { createClient } from '@/lib/supabase/client'
import type {
  SharedAccount,
  SharedAccountMember,
  SharedAccountMemberWithProfile,
  SharedAccountInvite,
  SharedCategory,
  SharedGoal,
  CategorySetupOption,
  InvitePageData,
} from '@/types/sharedAccount'
import type { Category } from '@/types/category'
import type { CategoryGoal } from '@/types/goal'
import type { Transaction } from '@/types/transaction'

// New tables aren't in generated Supabase types until migrations run
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => createClient()

// ─── Account ────────────────────────────────────────────────────────────────

export async function getMySharedAccount(): Promise<SharedAccount | null> {
  const supabase = db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Step 1: get most recent active membership (limit 1 to avoid crash if multiple exist)
  const { data: membership } = await supabase
    .from('shared_account_members')
    .select('shared_account_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!membership) return null

  // Step 2: fetch account separately (avoids embedded join issues with complex RLS)
  const { data: account } = await supabase
    .from('shared_accounts')
    .select('*')
    .eq('id', (membership as unknown as { shared_account_id: string }).shared_account_id)
    .maybeSingle()

  return (account as SharedAccount) ?? null
}

export async function createSharedAccount(name = 'Conta Compartilhada'): Promise<SharedAccount> {
  const supabase = db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: alreadyMember } = await supabase
    .from('shared_account_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (alreadyMember) throw new Error('Você já faz parte de uma conta compartilhada.')

  const { data: account, error: accErr } = await supabase
    .from('shared_accounts')
    .insert({ name, created_by: user.id })
    .select()
    .single()
  if (accErr) throw accErr

  const { error: memErr } = await supabase
    .from('shared_account_members')
    .insert({ shared_account_id: account.id, user_id: user.id, role: 'admin' })
  if (memErr) throw memErr

  return account as SharedAccount
}

export async function leaveSharedAccount(sharedAccountId: string): Promise<void> {
  const supabase = db()
  // Try cascade RPC first (dissolves for all members)
  const { error: rpcErr } = await supabase.rpc('leave_shared_account_cascade', {
    p_shared_account_id: sharedAccountId,
  })
  if (!rpcErr) return

  // Fallback: leave only own membership (works without the cascade SQL function)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { error } = await supabase
    .from('shared_account_members')
    .update({ status: 'left' })
    .eq('shared_account_id', sharedAccountId)
    .eq('user_id', user.id)
  if (error) throw error
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function getSharedAccountMembers(sharedAccountId: string): Promise<SharedAccountMemberWithProfile[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('shared_account_members')
    .select('*')
    .eq('shared_account_id', sharedAccountId)
    .eq('status', 'active')
  if (error) throw error

  const rows = (data ?? []) as unknown as SharedAccountMember[]

  // No direct FK from shared_account_members to profiles — fetch separately
  const userIds = rows.map((r) => r.user_id)
  const nameMap = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds)
    ;(profiles ?? []).forEach((p: { id: string; name: string | null }) => nameMap.set(p.id, p.name))

    // Fallback via RPC for users whose profile name is still null
    const missingIds = userIds.filter((id) => !nameMap.get(id))
    if (missingIds.length > 0) {
      const { data: authNames } = await supabase.rpc('get_users_names', { p_user_ids: missingIds })
      ;(authNames ?? []).forEach((u: { id: string; name: string }) => {
        if (!nameMap.get(u.id)) nameMap.set(u.id, u.name)
      })
    }
  }

  return rows.map((r) => ({ ...r, name: nameMap.get(r.user_id) ?? null, email: null }))
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function getOrCreateInvite(sharedAccountId: string, setupOption?: string): Promise<SharedAccountInvite> {
  const supabase = db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { count: memberCount } = await supabase
    .from('shared_account_members')
    .select('*', { count: 'exact', head: true })
    .eq('shared_account_id', sharedAccountId)
    .eq('status', 'active')
  if ((memberCount ?? 0) >= 2) throw new Error('Esta conta compartilhada já está completa (máximo 2 membros).')

  const { data: existing } = await supabase
    .from('shared_account_invites')
    .select('*')
    .eq('shared_account_id', sharedAccountId)
    .eq('created_by', user.id)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Update setup_option if it changed (e.g. user changed option before sending)
    if (setupOption !== undefined && existing.setup_option !== setupOption) {
      await supabase
        .from('shared_account_invites')
        .update({ setup_option: setupOption ?? null })
        .eq('id', existing.id)
      return { ...existing, setup_option: setupOption ?? null } as SharedAccountInvite
    }
    return existing as SharedAccountInvite
  }

  const { data, error } = await supabase
    .from('shared_account_invites')
    .insert({ shared_account_id: sharedAccountId, created_by: user.id, setup_option: setupOption ?? null })
    .select()
    .single()
  if (error) throw error
  return data as SharedAccountInvite
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = db()
  const { error } = await supabase
    .from('shared_account_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
  if (error) throw error
}

// ─── Public invite lookup (no auth needed) ───────────────────────────────────

export async function lookupInvitePageData(token: string): Promise<InvitePageData | null> {
  const supabase = db()

  const { data: invite } = await supabase
    .from('shared_account_invites')
    .select('*, shared_accounts(*)')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invite) return null

  const now = new Date()
  if (new Date(invite.expires_at) < now) return null

  const row = invite as unknown as Record<string, unknown>

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', (invite as unknown as SharedAccountInvite).created_by)
    .maybeSingle()

  return {
    invite: invite as unknown as SharedAccountInvite,
    account: row.shared_accounts as SharedAccount,
    inviterName: (profile as { name: string | null } | null)?.name ?? null,
  }
}

// ─── Accept invite ────────────────────────────────────────────────────────────

export async function acceptInvite(token: string): Promise<{ sharedAccountId: string; inviterId: string }> {
  const supabase = db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: invite, error: invErr } = await supabase
    .from('shared_account_invites')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()
  if (invErr || !invite) throw new Error('Convite inválido ou expirado')
  if (new Date(invite.expires_at) < new Date()) throw new Error('Convite expirado')
  if (invite.created_by === user.id) throw new Error('Você não pode aceitar seu próprio convite')

  // Block if invitee is already in any shared account
  const { data: anyMembership } = await supabase
    .from('shared_account_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (anyMembership) throw new Error('Você já faz parte de uma conta compartilhada. Saia dela antes de aceitar outro convite.')

  // Block if target account already has 2 members
  const { count: memberCount } = await supabase
    .from('shared_account_members')
    .select('*', { count: 'exact', head: true })
    .eq('shared_account_id', invite.shared_account_id)
    .eq('status', 'active')
  if ((memberCount ?? 0) >= 2) throw new Error('Esta conta compartilhada já está completa.')

  const { error: memErr } = await supabase
    .from('shared_account_members')
    .insert({ shared_account_id: invite.shared_account_id, user_id: user.id, role: 'member' })
  if (memErr) throw memErr

  const { error: updErr } = await supabase
    .from('shared_account_invites')
    .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
  if (updErr) throw updErr

  // Ensure profile name is saved (syncs auth metadata → profiles for users who signed up before this was required)
  const metaName = user.user_metadata?.name as string | undefined
  if (metaName) {
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
    if (!profile?.name) {
      await supabase.from('profiles').upsert({ id: user.id, name: metaName })
    }
  }

  return {
    sharedAccountId: invite.shared_account_id,
    inviterId: invite.created_by,
    setupOption: (invite.setup_option ?? null) as string | null,
  }
}

// ─── Category setup after invite acceptance ───────────────────────────────────

async function getMemberCategories(sharedAccountId: string, memberUserId: string): Promise<Category[]> {
  const supabase = db()
  const { data, error } = await supabase.rpc('get_shared_account_member_categories', {
    p_shared_account_id: sharedAccountId,
    p_member_user_id: memberUserId,
  })
  if (error) throw error
  return (data ?? []) as Category[]
}

async function getMemberGoals(sharedAccountId: string, memberUserId: string): Promise<CategoryGoal[]> {
  const supabase = db()
  const { data, error } = await supabase.rpc('get_shared_account_member_goals', {
    p_shared_account_id: sharedAccountId,
    p_member_user_id: memberUserId,
  })
  if (error) throw error
  return (data ?? []) as CategoryGoal[]
}

function normalizeName(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

async function createSharedCategories(
  sharedAccountId: string,
  categories: Category[],
  fromUserId: string
): Promise<SharedCategory[]> {
  if (categories.length === 0) return []
  const supabase = db()
  const rows = categories.map((c) => ({
    shared_account_id: sharedAccountId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: c.type,
    created_from_user_id: fromUserId,
    original_category_id: c.id,
  }))
  const { data, error } = await supabase.from('shared_categories').insert(rows).select()
  if (error) throw error
  return (data ?? []) as SharedCategory[]
}

async function createSharedGoals(
  sharedAccountId: string,
  goals: CategoryGoal[],
  sharedCategories: SharedCategory[],
  fromUserId: string
): Promise<void> {
  if (goals.length === 0) return
  const supabase = db()
  const rows = goals
    .map((g) => {
      const matching = sharedCategories.find((sc) => sc.original_category_id === g.category_id)
      if (!matching) return null
      return {
        shared_account_id: sharedAccountId,
        shared_category_id: matching.id,
        amount: g.amount,
        period: 'monthly',
        created_from_user_id: fromUserId,
      }
    })
    .filter(Boolean)

  if (rows.length === 0) return
  const { error } = await supabase.from('shared_goals').insert(rows)
  if (error) throw error
}

export async function setupSharedCategories(
  sharedAccountId: string,
  option: CategorySetupOption,
  myUserId: string,
  inviterId: string,
  myCategories: Category[],
  myGoals: CategoryGoal[]
): Promise<void> {
  if (option === 'zero') return

  if (option === 'mine') {
    const created = await createSharedCategories(sharedAccountId, myCategories, myUserId)
    await createSharedGoals(sharedAccountId, myGoals, created, myUserId)
    return
  }

  if (option === 'theirs') {
    const theirCats = await getMemberCategories(sharedAccountId, inviterId)
    const theirGoals = await getMemberGoals(sharedAccountId, inviterId)
    const created = await createSharedCategories(sharedAccountId, theirCats, inviterId)
    await createSharedGoals(sharedAccountId, theirGoals, created, inviterId)
    return
  }

  if (option === 'merge') {
    const theirCats = await getMemberCategories(sharedAccountId, inviterId)
    const theirGoals = await getMemberGoals(sharedAccountId, inviterId)

    const seen = new Map<string, Category>()
    for (const cat of [...myCategories, ...theirCats]) {
      const key = `${normalizeName(cat.name)}:${cat.type}`
      if (!seen.has(key)) seen.set(key, cat)
    }

    const merged = Array.from(seen.values())
    const created = await createSharedCategories(sharedAccountId, merged, myUserId)

    const allGoals = [...myGoals, ...theirGoals]
    const goalsByCategory = new Map<string, number>()
    for (const g of allGoals) {
      goalsByCategory.set(g.category_id, (goalsByCategory.get(g.category_id) ?? 0) + g.amount)
    }

    const mergedGoals: CategoryGoal[] = Array.from(goalsByCategory.entries()).map(([catId, amount]) => ({
      id: '',
      user_id: myUserId,
      category_id: catId,
      amount,
      created_at: '',
      updated_at: '',
    }))
    await createSharedGoals(sharedAccountId, mergedGoals, created, myUserId)
    return
  }
}

// ─── Shared transactions (via RPC) ───────────────────────────────────────────

export async function getSharedTransactions(
  sharedAccountId: string,
  dateFrom?: string,
  dateTo?: string,
  filterUserId?: string | null
): Promise<Transaction[]> {
  const supabase = db()
  const { data, error } = await supabase.rpc('get_shared_account_transactions', {
    p_shared_account_id: sharedAccountId,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
    p_filter_user_id: filterUserId ?? null,
  })
  if (error) throw error
  return (data ?? []) as unknown as Transaction[]
}

// ─── Category setup check ────────────────────────────────────────────────────

export async function countSharedCategories(sharedAccountId: string): Promise<number> {
  const supabase = db()
  const { count } = await supabase
    .from('shared_categories')
    .select('*', { count: 'exact', head: true })
    .eq('shared_account_id', sharedAccountId)
  return count ?? 0
}

// ─── Shared categories & goals (for unified goals view) ──────────────────────

export async function getSharedCategories(sharedAccountId: string): Promise<SharedCategory[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('shared_categories')
    .select('*')
    .eq('shared_account_id', sharedAccountId)
    .order('name')
  if (error) throw error
  return (data ?? []) as SharedCategory[]
}

export async function createSingleSharedCategory(
  sharedAccountId: string,
  data: { name: string; color: string; icon: string; type: string }
): Promise<SharedCategory> {
  const supabase = db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: result, error } = await supabase
    .from('shared_categories')
    .insert({
      shared_account_id: sharedAccountId,
      name: data.name,
      icon: data.icon,
      color: data.color,
      type: data.type,
      created_from_user_id: user.id,
      original_category_id: null,
    })
    .select()
    .single()
  if (error) throw error
  return result as SharedCategory
}

export async function updateSharedCategory(
  id: string,
  data: Partial<Pick<SharedCategory, 'name' | 'color' | 'icon' | 'type'>>
): Promise<SharedCategory> {
  const supabase = db()
  const { data: result, error } = await supabase
    .from('shared_categories')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return result as SharedCategory
}

export async function deleteSharedCategory(id: string): Promise<void> {
  const supabase = db()
  await supabase.from('shared_goals').delete().eq('shared_category_id', id)
  const { error } = await supabase.from('shared_categories').delete().eq('id', id)
  if (error) throw error
}

export async function getSharedGoals(sharedAccountId: string): Promise<SharedGoal[]> {
  const supabase = db()
  const { data, error } = await supabase
    .from('shared_goals')
    .select('*, shared_category:shared_categories(*)')
    .eq('shared_account_id', sharedAccountId)
  if (error) throw error
  return (data ?? []) as unknown as SharedGoal[]
}

export async function upsertSharedGoal(
  sharedAccountId: string,
  sharedCategoryId: string,
  amount: number
): Promise<SharedGoal> {
  const supabase = db()
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('shared_goals')
    .upsert(
      { shared_account_id: sharedAccountId, shared_category_id: sharedCategoryId, amount, period: 'monthly', created_from_user_id: user?.id },
      { onConflict: 'shared_account_id,shared_category_id' }
    )
    .select('*, shared_category:shared_categories(*)')
    .single()
  if (error) throw error
  return data as unknown as SharedGoal
}

export async function deleteSharedGoal(id: string): Promise<void> {
  const supabase = db()
  const { error } = await supabase.from('shared_goals').delete().eq('id', id)
  if (error) throw error
}
