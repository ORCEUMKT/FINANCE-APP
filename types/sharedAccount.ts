export interface SharedAccount {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface SharedAccountMember {
  id: string
  shared_account_id: string
  user_id: string
  role: 'admin' | 'member'
  status: 'active' | 'left'
  joined_at: string
  created_at: string
}

export interface SharedAccountMemberWithProfile extends SharedAccountMember {
  name: string | null
  email: string | null
}

export interface SharedAccountInvite {
  id: string
  shared_account_id: string
  token: string
  created_by: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  accepted_by: string | null
  accepted_at: string | null
  created_at: string
}

export interface SharedCategory {
  id: string
  shared_account_id: string
  name: string
  icon: string
  color: string
  type: 'expense' | 'income' | 'both'
  created_from_user_id: string | null
  original_category_id: string | null
  created_at: string
  updated_at: string
}

export interface SharedGoal {
  id: string
  shared_account_id: string
  shared_category_id: string | null
  amount: number
  period: string
  created_from_user_id: string | null
  created_at: string
  updated_at: string
  shared_category?: SharedCategory | null
}

export type CategorySetupOption = 'zero' | 'mine' | 'theirs' | 'merge'

export interface InvitePageData {
  invite: SharedAccountInvite
  account: SharedAccount
  inviterName: string | null
}
