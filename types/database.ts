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
      category_goals: {
        Row:    { id: string; user_id: string; category_id: string; amount: number; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; category_id: string; amount: number; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; category_id?: string; amount?: number }
        Relationships: []
      }
    }
    Views:     { [_ in never]: never }
    Functions: {
      get_personal_dashboard_metrics: {
        Args: { p_date_from: string | null; p_date_to: string | null }
        Returns: Json
      }
      get_shared_dashboard_metrics: {
        Args: {
          p_shared_account_id: string
          p_filter_user_id?:   string | null
          p_date_from?:        string | null
          p_date_to?:          string | null
        }
        Returns: Json
      }
      get_shared_account_transactions_page: {
        Args: {
          p_shared_account_id: string
          p_date_from?:        string | null
          p_date_to?:          string | null
          p_filter_user_id?:   string | null
          p_search?:           string | null
          p_sort_by?:          string | null
          p_page?:             number
          p_page_size?:        number
        }
        Returns: Json
      }
      get_personal_transactions_page: {
        Args: {
          p_date_from?:   string | null
          p_date_to?:     string | null
          p_category_id?: string | null
          p_search?:      string | null
          p_type?:        string | null
          p_status?:      string | null
          p_sort_by?:     string | null
          p_page?:        number
          p_page_size?:   number
        }
        Returns: Json
      }
    }
    Enums:     { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
