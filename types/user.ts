export interface Profile {
  id: string
  name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  label: string
  bank_name: string | null
  agency: string | null
  account_number: string | null
  created_at: string
}
