export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type TransactionType   = 'expense' | 'income' | 'recover'
export type TransactionStatus = 'paid' | 'pending' | 'recoverable' | 'recovered'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:    { id: string; name: string | null; email: string | null; avatar_url: string | null; created_at: string }
        Insert: { id: string; name?: string | null; email?: string | null; avatar_url?: string | null; created_at?: string }
        Update: { id?: string; name?: string | null; email?: string | null; avatar_url?: string | null }
        Relationships: []
      }
      categories: {
        Row:    { id: string; user_id: string; name: string; icon: string; color: string; type: string; is_default: boolean; created_at: string }
        Insert: { id?: string; user_id: string; name: string; icon?: string; color?: string; type?: string; is_default?: boolean; created_at?: string }
        Update: { id?: string; user_id?: string; name?: string; icon?: string; color?: string; type?: string; is_default?: boolean }
        Relationships: []
      }
      accounts: {
        Row:    { id: string; user_id: string; label: string; bank_name: string | null; agency: string | null; account_number: string | null; created_at: string }
        Insert: { id?: string; user_id: string; label?: string; bank_name?: string | null; agency?: string | null; account_number?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; label?: string; bank_name?: string | null; agency?: string | null; account_number?: string | null }
        Relationships: []
      }
      transactions: {
        Row:    { id: string; user_id: string; category_id: string | null; account_id: string | null; description: string; value: number; date: string; type: string; status: string; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; category_id?: string | null; account_id?: string | null; description: string; value: number; date: string; type?: string; status?: string; notes?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; category_id?: string | null; account_id?: string | null; description?: string; value?: number; date?: string; type?: string; status?: string; notes?: string | null }
        Relationships: []
      }
    }
    Views:     { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums:     { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
